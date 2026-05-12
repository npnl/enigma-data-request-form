from flask import Flask, request, jsonify, Response
import json
import boto3
import google.auth.transport.requests
from google.oauth2 import id_token
from functools import wraps
import os
import csv
import io
from flask_cors import CORS
import datetime
from typing import List, Dict
from utils import send_email
import base64
import sys

csv.field_size_limit(sys.maxsize)

application = Flask(__name__)
CORS(application)

# Configuration variables
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "collaborator-dir")
S3_SECRET_KEY = os.getenv("AWS_SECRET_KEY", None)
S3_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY", None)
COLLABORATORS_BUCKET = os.environ.get("COLLABORATORS_BUCKET", "collaborators-dir")
COLLABORATORS_KEY = os.environ.get("COLLABORATORS_KEY", "collaborators_new_test.csv")
ADMINS_BUCKET = os.environ.get("ADMINS_BUCKET", "collaborators-dir")
ADMINS_KEY = os.environ.get("ADMINS_KEY", "admins.csv")
SMTP_USERNAME = os.getenv("SMTP_USERNAME", None)
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", None)


JSON_LIST_FIELDS = [
    "email_list",
    "degrees",
    "department_list",
    "university_list",
    "address_list",
    "city_list",
    "state_list",
    "country_list",
    "cohort_enigma_list",
    "active_members",
    "former_members",
    "cohort_contributors",
    "cohort_funding",
    "funding_ack",
    "disclosures",
]

SCALAR_FIELDS = [
    "index",
    "timestamp",
    "primary_email",
    "first_name",
    "last_name",
    "MI",
    "orcid",
    "role",
    "profile_picture",
]

def _flatten_list(value):
    result = []
    stack = [value]
    while stack:
        current = stack.pop()
        if isinstance(current, list):
            # process in order
            stack.extend(reversed(current))
        else:
            result.append(current)
    return result


def _parse_collaborator_row(row: dict) -> dict:
    parsed = dict(row)
    parsed["members_initialized"] = parsed.get("members_initialized", False)
    is_active_raw = parsed.get("is_active", "TRUE")
    if isinstance(is_active_raw, str):
        parsed["is_active"] = is_active_raw.upper() == "TRUE"
    else:
        parsed["is_active"] = bool(is_active_raw)

    cohort_orig_map_raw = parsed.get("cohort_orig_map", "")
    if cohort_orig_map_raw:
        try:
            loaded = json.loads(cohort_orig_map_raw)
            if isinstance(loaded, dict):
                parsed["cohort_orig_map"] = loaded
            else:
                parsed["cohort_orig_map"] = {}
        except (json.JSONDecodeError, TypeError):
            parsed["cohort_orig_map"] = {}
    else:
        parsed["cohort_orig_map"] = {}
    
    pi_last_name_raw = parsed.get("pi_last_name", "")
    if pi_last_name_raw:
        try:
            loaded = json.loads(pi_last_name_raw)
            if isinstance(loaded, list):
                parsed["pi_last_name"] = loaded
            elif isinstance(loaded, str):
                parsed["pi_last_name"] = [loaded] if loaded else []
            else:
                parsed["pi_last_name"] = [str(loaded)]
        except (json.JSONDecodeError, TypeError):
            pi_last_name_str = str(pi_last_name_raw).strip()
            parsed["pi_last_name"] = [pi_last_name_str] if pi_last_name_str else []
    else:
        parsed["pi_last_name"] = []
    blanket_opt_in_raw = parsed.get("blanket_opt_in", "")
    if isinstance(blanket_opt_in_raw, str):
        parsed["blanket_opt_in"] = "yes" if blanket_opt_in_raw.lower().startswith("yes") else ""
    else:
        parsed["blanket_opt_in"] = ""

    for field in JSON_LIST_FIELDS:
        raw = parsed.get(field, "")
        if raw is None or str(raw).strip() in ["", "[]", "{}"]:
            parsed[field] = []
            continue
        raw_str = str(raw).strip()
        try:
            loaded = json.loads(raw_str)
            if isinstance(loaded, str):
                try:
                    loaded = json.loads(loaded)
                except json.JSONDecodeError:
                    parsed[field] = [loaded]
                    continue
            if isinstance(loaded, list):
                flat = _flatten_list(loaded)
                parsed[field] = flat
            elif isinstance(loaded, dict):
                parsed[field] = [loaded]
            else:
                parsed[field] = [loaded]

        except json.JSONDecodeError:
            parsed[field] = [raw_str]

    return parsed

def _serialize_collaborator_row(row: dict) -> dict:
    """
    Convert a Python dict (with lists) back into a flat dict of strings
    suitable for writing to CSV.
    """
    out = dict(row)

    out["index"] = str(out.get("index", "")).strip()
    out["timestamp"] = str(out.get("timestamp", "")).strip()
    out["primary_email"] = (out.get("primary_email") or "").strip()
    out["first_name"] = out.get("first_name", "") or ""
    out["last_name"] = out.get("last_name", "") or ""
    out["MI"] = out.get("MI", "") or ""
    out["orcid"] = out.get("orcid", "") or ""
    out["role"] = out.get("role", "") or ""
    out["profile_picture"] = out.get("profile_picture", "") or ""
    #out["cohort_funding_ack"] = out.get("cohort_funding_ack", "") or ""
    out["members_initialized"] = str(out.get("members_initialized", "")).strip()
    cohort_orig_map = out.get("cohort_orig_map", {})
    if isinstance(cohort_orig_map, dict):
        out["cohort_orig_map"] = json.dumps(cohort_orig_map, ensure_ascii=False)
    else:
        out["cohort_orig_map"] = json.dumps({}, ensure_ascii=False)
    pi_last_name = out.get("pi_last_name", [])
    if isinstance(pi_last_name, list):
        out["pi_last_name"] = json.dumps(pi_last_name, ensure_ascii=False)
    elif isinstance(pi_last_name, str) and pi_last_name:
        out["pi_last_name"] = json.dumps([pi_last_name], ensure_ascii=False)
    else:
        out["pi_last_name"] = json.dumps([], ensure_ascii=False)
    is_active = out.get("is_active", True)
    if isinstance(is_active, bool):
        out["is_active"] = "TRUE" if is_active else "FALSE"
    elif isinstance(is_active, str):
        out["is_active"] = "TRUE" if is_active.upper() == "TRUE" else "FALSE"
    else:
        out["is_active"] = "TRUE"
    blanket_opt_in = out.get("blanket_opt_in", "")
    out["blanket_opt_in"] = "yes" if blanket_opt_in else ""

    for field in JSON_LIST_FIELDS:
        value = out.get(field)

        if value is None or value == "":
            out[field] = json.dumps([])
            continue

        if isinstance(value, list):
            value = [v for v in value if v is not None and str(v).strip()]
            if not value:  
                out[field] = json.dumps([])
                continue
            flat = _flatten_list(value)
            out[field] = json.dumps(flat)
            continue

        if isinstance(value, dict):
            out[field] = json.dumps([value])
            continue

        if isinstance(value, str):
            raw = value.strip()
            try:
                loaded = json.loads(raw)
                if isinstance(loaded, list):
                    flat = _flatten_list(loaded)
                    out[field] = json.dumps(flat)
                elif isinstance(loaded, dict):
                    out[field] = json.dumps([loaded])
                else:
                    out[field] = json.dumps([loaded])
            except json.JSONDecodeError:
                out[field] = json.dumps([raw])
            continue

        out[field] = json.dumps([value])


    return out

def authenticate(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == "OPTIONS":
            return _build_cors_preflight_response()
        id_token_str = None
        auth_header = request.headers.get("Authorization", None)
        if auth_header and auth_header.startswith("Bearer "):
            id_token_str = auth_header.split("Bearer ")[1]
        else:
            return jsonify({"message": "Unauthorized"}), 401

        try:
            request_adapter = google.auth.transport.requests.Request()
            decoded_token = id_token.verify_firebase_token(
                id_token_str, request_adapter, audience=FIREBASE_PROJECT_ID
            )
            print(decoded_token)
            request.decoded_token = decoded_token
            return f(*args, **kwargs)
        except Exception as e:
            print(f"Token verification failed: {e}")
            return jsonify({"message": "Unauthorized"}), 401

    return decorated_function

def check_user_authorization(request):
    """
    Check if user is authorized to access the system.
    Returns user details and permissions.
    """
    try:
        decoded_token = request.decoded_token
        user_email = (decoded_token.get("email") or "").lower()
        
        if not user_email:
            return jsonify({"authorized": False, "message": "Email not found"}), 400
        
        admins = get_admins_list()
        is_admin = user_email in [a.lower() for a in admins]
        
        collaborators = get_collaborators_data()
        user_collab = None
        for collab in collaborators:
            if (collab.get("primary_email") or "").lower() == user_email:
                user_collab = collab
                break
        
        if is_admin:
            is_active = user_collab.get("is_active", True) if user_collab else True
            return jsonify({
                "authorized": True,
                "is_admin": True,
                "is_collaborator": bool(user_collab),
                "can_access_collaborators_console": True,
                "can_access_data_request": True,
                "is_active": is_active,
                "user_details": user_collab
            }), 200
        elif user_collab:
            is_active = user_collab.get("is_active", True)
            if not is_active:
                return jsonify({
                    "authorized": False,
                    "message": "Your account is inactive. You cannot access the system. Please contact NPNL at npnlusc@gmail.com to reactivate your account."
                }), 403
            return jsonify({
                "authorized": True,
                "is_admin": False,
                "is_collaborator": True,
                "can_access_collaborators_console": True,
                "can_access_data_request": True,
                "is_active": is_active,
                "user_details": user_collab
            }), 200
        
        else:
            return jsonify({
                "authorized": False,
                "message": "You are not authorized to access this system. Please contact NPNL at mhkhan@usc.edu."
            }), 403
            
    except Exception as e:
        print(f"Error in check_user_authorization: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "authorized": False,
            "message": "Internal server error"
        }), 500
    

# Helper functions
def get_collaborators_data():
    s3 = boto3.client(
        "s3",
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name="us-east-1",
    )
    obj = s3.get_object(Bucket=COLLABORATORS_BUCKET, Key=COLLABORATORS_KEY)
    data = obj["Body"].read().decode("utf-8").splitlines()
    reader = csv.DictReader(data)
    collaborators = []
    for row in reader:
        collaborators.append(_parse_collaborator_row(row))
   
    return collaborators


def get_admins_list():
    s3 = boto3.client(
        "s3",
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name="us-east-1",
    )
    obj = s3.get_object(Bucket=ADMINS_BUCKET, Key=ADMINS_KEY)
    data = obj["Body"].read().decode("utf-8").splitlines()
    reader = csv.DictReader(data)
    admins = [row["email"] for row in reader]
    return admins


def is_admin(decoded_token):
    user_email = decoded_token.get("email")
    admins = get_admins_list()
    return user_email in admins


def update_s3_csv(bucket, key, data, fieldnames):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(data)
    csv_data = output.getvalue()

    s3 = boto3.client(
        "s3",
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name="us-east-1",
    )
    s3.put_object(Bucket=bucket, Key=key, Body=csv_data.encode("utf-8"))

def update_s3_collaborators_csv(collaborators: List[dict]):
    """
    Write the list of collaborator dicts back to S3 in the same
    new CSV format.
    """
    if not collaborators:
        return

    fieldnames = [
        "index",
        "timestamp",
        "primary_email",
        "email_list",
        "first_name",
        "last_name",
        "MI",
        "degrees",
        "orcid",
        "department_list",
        "university_list",
        "address_list",
        "city_list",
        "state_list",
        "country_list",
        "cohort_enigma_list",
        "cohort_orig_map",
        "role",
        "pi_last_name",
        "profile_picture",
        "active_members",
        "former_members",
        "cohort_funding",
        'cohort_contributors',
        "funding_ack",
        "disclosures",
        "members_initialized",
        "is_active",
        "blanket_opt_in",
    ]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for collab in collaborators:
        flat_row = _serialize_collaborator_row(collab)
        writer.writerow(flat_row)

    csv_data = output.getvalue()

    s3 = boto3.client(
        "s3",
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name="us-east-1",
    )
    s3.put_object(
        Bucket=COLLABORATORS_BUCKET,
        Key=COLLABORATORS_KEY,
        Body=csv_data.encode("utf-8"),
    )

def get_user_details(request):
    try:
        decoded_token = request.decoded_token
        user_email = decoded_token.get("email")
        if not user_email:
            return jsonify({"message": "Email not found in token"}), 400

        collaborators = get_collaborators_data()
        user_details = None
        for collaborator in collaborators:
            if (collaborator.get("primary_email") or "").lower() == user_email.lower():
                user_details = collaborator
                break

        if not user_details:
            return jsonify({"message": "User not found"}), 404

        if user_details.get("role") in ["PI", "Co-PI"]:
            pi_email = user_details.get("primary_email", "")
            pi_last_name = user_details.get("last_name", "")
            initialized = user_details.get("members_initialized", False)
            all_potential_members = get_cohort_members(pi_last_name, collaborators, exclude_email=pi_email)
            if not initialized:
                user_details["active_members"] = all_potential_members
            else:
                existing_active = user_details.get("active_members", [])
                existing_former = user_details.get("former_members", [])
                active_emails = {m.get("email", "").lower() for m in existing_active if isinstance(m, dict)}
                former_emails = {m.get("email", "").lower() for m in existing_former if isinstance(m, dict)}
                
                new_members = []
                for member in all_potential_members:
                    member_email = member["email"].lower()
                    if member_email not in active_emails and member_email not in former_emails:
                        new_members.append(member)
                
                if new_members:
                    user_details["active_members"] = existing_active + new_members

        return jsonify(user_details), 200
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Internal server error"}), 500

def send_inactive_user_email(email):
    """Send email to inactive user attempting to log in"""
    subject = "Account Inactive - NPNL Collaborator Console"
    body = """Hello,

Your account in the NPNL Collaborator Console is currently inactive.

To reactivate your account, please contact the NPNL team at npnlusc@gmail.com.

Best regards,
NPNL Team
"""
    try:
        send_email(email, subject, body)
        print(f"Inactive user email sent to {email}")
    except Exception as e:
        print(f"Failed to send inactive user email: {e}")

def get_user_role_and_cohorts(user_email: str, collaborators: List[dict]):
    user_email = user_email.lower()
    for collab in collaborators:
        if (collab.get("primary_email") or "").lower() == user_email:
            role = collab.get("role", "Member")
            cohorts = collab.get("cohort_enigma_list", [])
            return role, cohorts
    return None, []

def upload_profile_picture(request):
    """
    Upload a profile picture to S3 and return the URL.
    """
    try:
        decoded_token = request.decoded_token
        user_email = (decoded_token.get("email") or "").lower()
        
        data = request.get_json()
        if not data or "image" not in data:
            return jsonify({"message": "No image provided"}), 400
        
        base64_image = data["image"]
        if "," in base64_image:
            base64_image = base64_image.split(",")[1]
        
        try:
            image_data = base64.b64decode(base64_image)
        except Exception as e:
            print(f"Error decoding base64: {e}")
            return jsonify({"message": "Invalid image data"}), 400
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        user_index = data.get("user_index", user_email.replace("@", "_").replace(".", "_"))
        filename = f"profile_pictures/{user_index}_{timestamp}.jpg"
        
        s3 = boto3.client(
            "s3",
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY,
            region_name="us-east-1",
        )
        
        s3.put_object(
            Bucket=COLLABORATORS_BUCKET,
            Key=filename,
            Body=image_data,
            ContentType="image/jpeg",
        )
        
        image_url = f"https://{COLLABORATORS_BUCKET}.s3.amazonaws.com/{filename}"
        
        print(f"Profile picture uploaded: {image_url}")
        
        return jsonify({
            "message": "Image uploaded successfully",
            "url": image_url
        }), 200
        
    except Exception as e:
        print(f"Error uploading profile picture: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Internal server error"}), 500
    
def delete_profile_picture(request):
    """
    Delete a profile picture from S3
    """
    try:
        decoded_token = request.decoded_token
        user_email = (decoded_token.get("email") or "").lower()
        
        data = request.get_json()
        image_url = data.get("image_url")
        
        if not image_url:
            return jsonify({"message": "Image URL is required"}), 400
        
        try:
            from urllib.parse import urlparse
            parsed_url = urlparse(image_url)
            s3_key = parsed_url.path.lstrip('/')
            
            
        except Exception as e:
            print(f"Error parsing URL: {e}")
            return jsonify({"message": "Invalid image URL"}), 400
        
        s3 = boto3.client(
            "s3",
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY,
            region_name="us-east-1",
        )
        
        s3.delete_object(
            Bucket=COLLABORATORS_BUCKET,
            Key=s3_key
        )
        
        
        return jsonify({"message": "Profile picture deleted successfully"}), 200
        
    except Exception as e:
        print(f"Error deleting profile picture: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Internal server error"}), 500

def get_user_by_index(request):
    try:
        decoded_token = request.decoded_token
        user_email = (decoded_token.get("email") or "").lower()

        collaborators = get_collaborators_data()

        index = request.args.get("index")
        if not index:
            return jsonify({"message": "Missing index"}), 400

        target = next((c for c in collaborators if str(c.get("index")) == str(index)), None)
        if not target:
            return jsonify({"message": "Not found"}), 404

        if target.get("role") in ["PI", "Co-PI"]:
            pi_email = target.get("primary_email", "")
            pi_last_name = target.get("last_name", "")
            initialized = target.get("members_initialized", False)
            all_potential_members = get_cohort_members(pi_last_name, collaborators, exclude_email=pi_email)

            if not initialized:
                target["active_members"] = all_potential_members
            else:
                existing_active = target.get("active_members", [])
                existing_former = target.get("former_members", [])
                
                active_emails = {m.get("email", "").lower() for m in existing_active if isinstance(m, dict)}
                former_emails = {m.get("email", "").lower() for m in existing_former if isinstance(m, dict)}
                new_members = []
                for member in all_potential_members:
                    member_email = member["email"].lower()
                    if member_email not in active_emails and member_email not in former_emails:
                        new_members.append(member)
                if new_members:
                    target["active_members"] = existing_active + new_members
            
            
        if is_admin(decoded_token):
            return jsonify(target), 200
        if user_email == (target.get("primary_email") or "").lower():
            return jsonify(target), 200

        me = next(
            (c for c in collaborators if (c.get("primary_email") or "").lower() == user_email),
            None
        )

        if me and me.get("role") in ["PI", "Co-PI"]:
            my_last = (me.get("last_name") or "").strip().lower()
            target_pi_list = target.get("pi_last_name", [])
            if isinstance(target_pi_list, str):
                target_pi_list = [target_pi_list] if target_pi_list else []
            target_pi_list_lower = [pi.strip().lower() for pi in target_pi_list if pi]

            if my_last in target_pi_list_lower:
                return jsonify(target), 200

        return jsonify({"message": "Forbidden"}), 403

    except Exception as e:
        print("Error in get_user_by_index:", e)
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Internal server error"}), 500

def update_user_details(request):
    try:
        decoded_token = request.decoded_token
        user_email = (decoded_token.get("email") or "").lower()
        if not user_email:
            return jsonify({"message": "Email not found in token"}), 400

        user_updates = request.get_json()
        if not user_updates:
            return jsonify({"message": "Invalid request body"}), 400

        target_index = str(user_updates.get("index"))
        if not target_index:
            return jsonify({"message": "Missing index"}), 400

        collaborators = get_collaborators_data()

        # Find the target collaborator
        target = None
        target_idx = None
        for idx, collab in enumerate(collaborators):
            if str(collab.get("index")) == target_index:
                target = collab
                target_idx = idx
                break

        if not target:
            return jsonify({"message": "User not found"}), 404

        target_email = (target.get("primary_email") or "").lower()
        
        if "is_active" in user_updates and target.get("role") not in ["PI", "Co-PI"]:
            new_is_active = user_updates.get("is_active")
            target["is_active"] = new_is_active
            target_pi_list = target.get("pi_last_name", [])
            if isinstance(target_pi_list, str):
                target_pi_list = [target_pi_list] if target_pi_list else []

            for pi_last_name in target_pi_list:
                pi_last_name_lower = pi_last_name.strip().lower()
                for idx, collab in enumerate(collaborators):
                    if collab.get("role") in ["PI", "Co-PI"]:
                        pi_last_name = (collab.get("last_name") or "").strip().lower()
                        
                        if pi_last_name == pi_last_name_lower:
                            member_info = {
                                "first_name": target.get("first_name", ""),
                                "last_name": target.get("last_name", ""),
                                "email": target.get("primary_email", ""),
                                "role": target.get("role", "Member"),
                            }
                            
                            active_members = collab.get("active_members", [])
                            former_members = collab.get("former_members", [])
                            
                            active_members = [
                                m for m in active_members 
                                if isinstance(m, dict) and (m.get("email") or "").lower() != target_email
                            ]
                            former_members = [
                                m for m in former_members 
                                if isinstance(m, dict) and (m.get("email") or "").lower() != target_email
                            ]
                            
                            if new_is_active:
                                active_members.append(member_info)
                                print(f"Moving {target_email} to active_members of PI {pi_last_name}")
                            else:
                                former_members.append(member_info)
                                print(f"Moving {target_email} to former_members of PI {pi_last_name}")
                            
                            collaborators[idx]["active_members"] = active_members
                            collaborators[idx]["former_members"] = former_members
                            collaborators[idx]["members_initialized"] = True
                            break

        target["timestamp"] = datetime.datetime.now().isoformat()
        
        if "is_active" in user_updates:
            target["is_active"] = user_updates["is_active"]

        if "role" in user_updates:
            old_role = target.get("role")
            target["role"] = user_updates["role"]
            if user_updates["role"] in ["PI", "Co-PI"] and old_role == "Member":
                old_pi_list = target.get("pi_last_name", [])
                if isinstance(old_pi_list, str):
                    old_pi_list = [old_pi_list] if old_pi_list else []
                target["pi_last_name"] = []
                member_email = target.get("primary_email", "").lower()
                for old_pi_name in old_pi_list:
                    old_pi_name_lower = old_pi_name.strip().lower()
                    
                    for idx, collab in enumerate(collaborators):
                        if collab.get("role") in ["PI", "Co-PI"]:
                            pi_last_name = (collab.get("last_name") or "").strip().lower()
                            
                            if pi_last_name == old_pi_name_lower:
                                active_members = collab.get("active_members", [])
                                active_members = [
                                    m for m in active_members 
                                    if isinstance(m, dict) and (m.get("email") or "").lower() != member_email
                                ]
                                
                                former_members = collab.get("former_members", [])
                                former_members = [
                                    m for m in former_members 
                                    if isinstance(m, dict) and (m.get("email") or "").lower() != member_email
                                ]
                                
                                collaborators[idx]["active_members"] = active_members
                                collaborators[idx]["former_members"] = former_members
                                break

        emails = user_updates.get("emails") or user_updates.get("email_list") or []
        if isinstance(emails, str):
            emails = [emails]
        emails = [e.strip() for e in emails if e and e.strip()]
        if emails:
            target["primary_email"] = emails[0]
            target["email_list"] = emails
        
        old_pi_list_saved = target.get("pi_last_name", [])
        if "pi_last_name" in user_updates:
            target["pi_last_name"] = user_updates["pi_last_name"]

        new_pi_list = target.get("pi_last_name", [])
        # new_pi_list = user_updates.get("pi_last_name", target.get("pi_last_name", []))
        if "pi_last_name" in user_updates and target.get("role") == "Member":
            old_pi_list = old_pi_list_saved
            new_pi_list = user_updates.get("pi_last_name", [])
            
            if isinstance(old_pi_list, str):
                old_pi_list = [old_pi_list] if old_pi_list else []
            if isinstance(new_pi_list, str):
                new_pi_list = [new_pi_list] if new_pi_list else []
            
            old_pi_set = set(pi.strip().lower() for pi in old_pi_list if pi)
            new_pi_set = set(pi.strip().lower() for pi in new_pi_list if pi)
            

            removed_pis = old_pi_set - new_pi_set
            added_pis = new_pi_set - old_pi_set
            
            member_email = target.get("primary_email", "").lower()
            
            for removed_pi_name in removed_pis:
                for idx, collab in enumerate(collaborators):
                    if collab.get("role") in ["PI", "Co-PI"]:
                        pi_last_name = (collab.get("last_name") or "").strip().lower()
                        
                        if pi_last_name == removed_pi_name:
                            active_members = collab.get("active_members", [])
                            active_members = [
                                m for m in active_members 
                                if isinstance(m, dict) and (m.get("email") or "").lower() != member_email
                            ]
                            
                            former_members = collab.get("former_members", [])
                            former_members = [
                                m for m in former_members 
                                if isinstance(m, dict) and (m.get("email") or "").lower() != member_email
                            ]
                            
                            member_info = {
                                "first_name": target.get("first_name", ""),
                                "last_name": target.get("last_name", ""),
                                "email": target.get("primary_email", ""),
                                "role": "Member",
                            }
                            former_members.append(member_info)
                            
                            collaborators[idx]["active_members"] = active_members
                            collaborators[idx]["former_members"] = former_members
                            print(f"Removed member {member_email} from PI {removed_pi_name}'s active_members (moved to former)")
                            break
            
            for added_pi_name in added_pis:
                for idx, collab in enumerate(collaborators):
                    if collab.get("role") in ["PI", "Co-PI"]:
                        pi_last_name = (collab.get("last_name") or "").strip().lower()
                        
                        if pi_last_name == added_pi_name:
                            member_info = {
                                "first_name": target.get("first_name", ""),
                                "last_name": target.get("last_name", ""),
                                "email": target.get("primary_email", ""),
                                "role": "Member",
                            }
                            
                            former_members = collab.get("former_members", [])
                            former_members = [
                                m for m in former_members 
                                if isinstance(m, dict) and (m.get("email") or "").lower() != member_email
                            ]
                            
                            active_members = collab.get("active_members", [])
                            member_exists = any(
                                m.get("email", "").lower() == member_email
                                for m in active_members if isinstance(m, dict)
                            )
                            
                            if not member_exists:
                                active_members.append(member_info)
                            
                            collaborators[idx]["active_members"] = active_members
                            collaborators[idx]["former_members"] = former_members
                            collaborators[idx]["members_initialized"] = True
                            print(f"Added member {member_email} to PI {added_pi_name}'s active_members")
                            break
        
        for key in ["first_name", "last_name", "MI", "orcid", "role", "profile_picture", "pi_last_name", "blanket_opt_in"]:
            if key in user_updates:
                target[key] = user_updates[key]

        for key in ["degrees", "cohort_enigma_list", "active_members", "former_members", "disclosures"]:
            if key in user_updates:
                target[key] = user_updates[key] if user_updates[key] is not None else []
        if "cohort_orig_map" in user_updates:
            target["cohort_orig_map"] = user_updates["cohort_orig_map"] if user_updates["cohort_orig_map"] is not None else {}
        
        if "active_members" in user_updates or "former_members" in user_updates:
            target["members_initialized"] = True
        
        if "funding" in user_updates:
            target["funding_ack"] = user_updates["funding"] if user_updates["funding"] is not None else []
        elif "funding_ack" in user_updates:
            target["funding_ack"] = user_updates["funding_ack"] if user_updates["funding_ack"] is not None else []
        if "cohort_contributors" in user_updates:
            target["cohort_contributors"] = user_updates["cohort_contributors"]
        if "cohort_funding" in user_updates:
            target["cohort_funding"] = user_updates["cohort_funding"]
        
        if "institutions" in user_updates and user_updates["institutions"]:
            institutions = user_updates["institutions"]
            if isinstance(institutions, list):
                target["department_list"] = [inst.get("department", "") for inst in institutions]
                target["university_list"] = [inst.get("university", "") for inst in institutions]
                target["address_list"] = [inst.get("address", "") for inst in institutions]
                target["city_list"] = [inst.get("city", "") for inst in institutions]
                target["state_list"] = [inst.get("state", "") for inst in institutions]
                target["country_list"] = [inst.get("country", "") for inst in institutions]
            else:
                target["department_list"] = [institutions.get("department", "")]
                target["university_list"] = [institutions.get("university", "")]
                target["address_list"] = [institutions.get("address", "")]
                target["city_list"] = [institutions.get("city", "")]
                target["state_list"] = [institutions.get("state", "")]
                target["country_list"] = [institutions.get("country", "")]
        collaborators[target_idx] = target

        if target.get("role") in ["PI", "Co-PI"]:
            target["is_active"] = True
        elif target.get("role") == "Member":
            if isinstance(new_pi_list, str):
                new_pi_list = [new_pi_list] if new_pi_list else []
            
            target["is_active"] = len(new_pi_list) > 0

        if "active_members" in user_updates or "former_members" in user_updates:
            if target.get("role") in ["PI", "Co-PI"]:
                pi_last_name = (target.get("last_name") or "").strip()
                old_data = get_collaborators_data()[target_idx]
                old_active_members = old_data.get("active_members", [])
                old_former_members = old_data.get("former_members", [])
                new_active_members = user_updates.get("active_members", target.get("active_members", []))
                new_former_members = user_updates.get("former_members", target.get("former_members", []))
                #old_former_members = get_collaborators_data()[target_idx].get("former_members", [])
                #new_former_members = user_updates.get("former_members", [])
                
                #old_former_emails = {(m.get("email") or "").lower() for m in old_former_members if isinstance(m, dict)}
                #new_former_emails = {(m.get("email") or "").lower() for m in new_former_members if isinstance(m, dict)}
                old_active_emails = {(m.get("email") or "").lower() for m in old_active_members if isinstance(m, dict)}
                old_former_emails = {(m.get("email") or "").lower() for m in old_former_members if isinstance(m, dict)}
                new_active_emails = {(m.get("email") or "").lower() for m in new_active_members if isinstance(m, dict)}
                new_former_emails = {(m.get("email") or "").lower() for m in new_former_members if isinstance(m, dict)}

                newly_active = new_active_emails - old_active_emails - old_former_emails
                for member_email in newly_active:
                    for idx, collab in enumerate(collaborators):
                        if (collab.get("primary_email") or "").lower() == member_email:
                            member_pi_list = collab.get("pi_last_name", [])
                            if isinstance(member_pi_list, str):
                                member_pi_list = [member_pi_list] if member_pi_list else []
                            
                            # Add this PI if not already in list
                            if pi_last_name and pi_last_name not in member_pi_list:
                                member_pi_list.append(pi_last_name)
                                collaborators[idx]["pi_last_name"] = member_pi_list
                                print(f"Added PI '{pi_last_name}' to member {member_email}'s PI list: {member_pi_list}")
                            
                            collaborators[idx]["is_active"] = True
                            break

                newly_former = new_former_emails - old_former_emails
                for member_email in newly_former:
                    for idx, collab in enumerate(collaborators):
                        if (collab.get("primary_email") or "").lower() == member_email:
                            # Get current PI list
                            member_pi_list = collab.get("pi_last_name", [])
                            if isinstance(member_pi_list, str):
                                member_pi_list = [member_pi_list] if member_pi_list else []
                            # Remove this PI from list
                            if pi_last_name in member_pi_list:
                                member_pi_list.remove(pi_last_name)
                                collaborators[idx]["pi_last_name"] = member_pi_list
                                print(f"Removed PI '{pi_last_name}' from member {member_email}'s PI list: {member_pi_list}")
                            # Only set inactive if no PIs left
                            if len(member_pi_list) == 0:
                                collaborators[idx]["is_active"] = False
                                print(f"Setting {member_email} as inactive (no PIs left)")
                            break
                            #collaborators[idx]["is_active"] = False
                            #print(f"Setting {member_email} as inactive (moved to former_members)")
                            #break
                
                # Find reactivated members
                reactivated = old_former_emails & new_active_emails
                for member_email in reactivated:
                    for idx, collab in enumerate(collaborators):
                        if (collab.get("primary_email") or "").lower() == member_email:
                            # Get current PI list
                            member_pi_list = collab.get("pi_last_name", [])
                            if isinstance(member_pi_list, str):
                                member_pi_list = [member_pi_list] if member_pi_list else []
                            
                            # Add this PI back if not already in list
                            if pi_last_name and pi_last_name not in member_pi_list:
                                member_pi_list.append(pi_last_name)
                                collaborators[idx]["pi_last_name"] = member_pi_list
                                print(f"Reactivated: Added PI '{pi_last_name}' back to member {member_email}'s PI list: {member_pi_list}")
                            
                            collaborators[idx]["is_active"] = True
                            break
        
        update_s3_collaborators_csv(collaborators)

        return jsonify({"message": "User details updated successfully"}), 200

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Internal server error"}), 500
    
def get_pis_by_cohort():
    """
    Get PI/Co-PI names grouped by cohort.
    Returns a dictionary mapping cohort names to lists of PI information.
    """
    try:
        collaborators = get_collaborators_data()
        
        cohort_pi_map = {}
        
        for collab in collaborators:
            if collab.get("role") in ["PI", "Co-PI"]:
                cohorts = collab.get("cohort_enigma_list", [])
                pi_name = f"{collab.get('first_name', '')} {collab.get('last_name', '')}".strip()
                role = collab.get("role", "")
                
                for cohort in cohorts:
                    cohort_name = cohort.strip()
                    if cohort_name:
                        if cohort_name not in cohort_pi_map:
                            cohort_pi_map[cohort_name] = []
                        
                        pi_info = {"name": pi_name, "role": role}
                        
                        if pi_name and not any(p["name"] == pi_name for p in cohort_pi_map[cohort_name]):
                            cohort_pi_map[cohort_name].append(pi_info)
        
        return cohort_pi_map
        
    except Exception as e:
        print(f"Error in get_pis_by_cohort: {e}")
        import traceback
        traceback.print_exc()
        return {}

def get_current_user_role(request):
    try:
        decoded_token = request.decoded_token
        user_email = (decoded_token.get("email") or "").lower()
        
        if is_admin(decoded_token):
            return jsonify({
                "role": "Admin",
                "cohorts": [],
                "is_admin": True
            }), 200
        
        collaborators = get_collaborators_data()
        role, cohorts = get_user_role_and_cohorts(user_email, collaborators)
        
        if role is None:
            return jsonify({"message": "User not found"}), 404
        
        return jsonify({
            "role": role,
            "cohorts": cohorts,
            "is_admin": False
        }), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": "Internal server error"}), 500


def delete_collaborator(request):
    try:
        decoded_token = request.decoded_token
        if not is_admin(decoded_token):
            return jsonify({"message": "Forbidden"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request body"}), 400

        target_index = data.get("index")
        target_email = data.get("email")

        if not target_index and not target_email:
            return jsonify({"message": "Missing index or email"}), 400

        collaborators = get_collaborators_data()
        deleted_collab = None
        deleted_email = None

        updated_collaborators = []
        found = False
        for collab in collaborators:
            match = False
            if target_index and str(collab.get("index")) == str(target_index):
                match = True
            elif target_email and (collab.get("primary_email") or "").lower() == target_email.lower():
                match = True
            if match:
                deleted_collab = collab
                deleted_email = (collab.get("primary_email") or "").lower()
                break

        if not deleted_collab:
            return jsonify({"message": "Collaborator not found"}), 404
        for collab in collaborators:
            if collab.get("role") in ["PI", "Co-PI"]:
                updated = False
                active_members = collab.get("active_members", [])
                if active_members:
                    original_count = len(active_members)
                    active_members = [
                        m for m in active_members 
                        if isinstance(m, dict) and (m.get("email") or "").lower() != deleted_email
                    ]
                    if len(active_members) < original_count:
                        collab["active_members"] = active_members
                        updated = True
                
                former_members = collab.get("former_members", [])
                if former_members:
                    original_count = len(former_members)
                    former_members = [
                        m for m in former_members 
                        if isinstance(m, dict) and (m.get("email") or "").lower() != deleted_email
                    ]
                    if len(former_members) < original_count:
                        collab["former_members"] = former_members
                        updated = True

        updated_collaborators = []
        for collab in collaborators:
            if collab.get("primary_email", "").lower() != deleted_email:
                updated_collaborators.append(collab)

        update_s3_collaborators_csv(updated_collaborators)

        return jsonify({"message": "Collaborator deleted successfully"}), 200

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": "Internal server error"}), 500


def add_collaborator(request):
    try:
        decoded_token = request.decoded_token
        admin = is_admin(decoded_token)
        if not admin:
            user_email = (decoded_token.get("email") or "").lower()
            collaborators = get_collaborators_data()
            current_user = next(
                (c for c in collaborators if (c.get("primary_email") or "").lower() == user_email),
                None
            )
            if not current_user or current_user.get("role") not in ["PI", "Co-PI"]:
                return jsonify({"message": "Only Admins and PIs can add collaborators"}), 403
            is_pi = True
            pi_last_name = current_user.get("last_name", "")
        else:
            is_pi = False

        payload = request.get_json()
        if not payload or "emails" not in payload:
            return jsonify({"message": "Invalid request body"}), 400

        emails = payload.get("emails") or []
        emails = [e.strip() for e in emails if e and e.strip()]

        if not emails:
            return jsonify({"message": "At least one email is required"}), 400

        primary_email = emails[0]

        collaborators = get_collaborators_data()

        # Check if collaborator already exists by primary_email
        for collab in collaborators:
            if collab.get("primary_email", "").lower() == primary_email.lower():
                return jsonify({"message": "Collaborator already exists"}), 400

        max_index = max([int(c.get("index") or 0) for c in collaborators], default=0)
        institutions = payload.get("institutions", [])
        department_list = []
        university_list = []
        address_list = []
        city_list = []
        state_list = []
        country_list = []
        for inst in institutions:
            department_list.append(inst.get("department", ""))
            university_list.append(inst.get("university", ""))
            address_list.append(inst.get("address", ""))
            city_list.append(inst.get("city", ""))
            state_list.append(inst.get("state", ""))
            country_list.append(inst.get("country", ""))
        # If PI is adding, use empty cohort and default role
        if is_pi:
            cohort_enigma_list = []  # PIs can't set cohorts
            cohort_orig_map = {}
            role = "Member"  # Default role for PI-added collaborators
        else:
            # Admin can set everything
            cohort_enigma_list = payload.get("cohort_enigma_list", [])
            cohort_orig_map = payload.get("cohort_orig_map", {})
            role = payload.get("role", "")
        if is_pi:
            # PI is adding the member - use PI's last name as a single-item list
            pi_last_name_list = [pi_last_name] if pi_last_name else []
        else:
            # Admin is adding - get from payload and ensure it's a list
            pi_last_name_from_payload = payload.get("pi_last_name", [])
            if isinstance(pi_last_name_from_payload, str):
                # Convert string to list
                pi_last_name_list = [pi_last_name_from_payload] if pi_last_name_from_payload else []
            elif isinstance(pi_last_name_from_payload, list):
                # Already a list
                pi_last_name_list = pi_last_name_from_payload
            else:
                pi_last_name_list = []
        new_collab = {
            "index": str(max_index + 1),
            "timestamp": datetime.datetime.now().isoformat(),
            "primary_email": primary_email,
            "email_list": emails,
            "first_name": payload.get("first_name", "").strip(),
            "last_name": payload.get("last_name", "").strip(),
            "MI": payload.get("MI", "").strip(),
            "degrees": payload.get("degrees", []),
            "orcid": payload.get("orcid", "").strip(),
            "profile_picture": payload.get("profile_picture", ""),
            "department_list": department_list,
            "university_list": university_list,
            "address_list": address_list,
            "city_list": city_list,
            "state_list": state_list,
            "country_list": country_list,
            "cohort_enigma_list": cohort_enigma_list,
            "cohort_orig_map": cohort_orig_map,
            "role": role,
            "pi_last_name": pi_last_name_list,
            "members_initialized": False,
            "is_active": True,
            "active_members": payload.get("active_members", []),
            "former_members": payload.get("former_members", []),
            #"cohort_funding_ack": payload.get("cohort_funding_ack", ""),
            #"contributing_members": payload.get("contributing_members", []),
            "funding_ack": payload.get("funding", []),
            "disclosures": payload.get("disclosures", []),
            "blanket_opt_in": payload.get("blanket_opt_in", ""),
        }

        collaborators.append(new_collab)
        if role == "Member" and pi_last_name_list:
            member_info = {
                "first_name": new_collab.get("first_name", ""),
                "last_name": new_collab.get("last_name", ""),
                "email": new_collab.get("primary_email", ""),
                "role": "Member",
            }
            for pi_name in pi_last_name_list:
                pi_name_lower = pi_name.strip().lower()
                for idx, collab in enumerate(collaborators):
                    if collab.get("role") in ["PI", "Co-PI"]:
                        collab_last_name = (collab.get("last_name") or "").strip().lower()
                        if collab_last_name == pi_name_lower:
                            # Initialize active_members if needed
                            if "active_members" not in collab or not isinstance(collab["active_members"], list):
                                collab["active_members"] = []
                            
                            # Check if member not already in list
                            member_exists = any(
                                m.get("email", "").lower() == primary_email.lower()
                                for m in collab["active_members"]
                                if isinstance(m, dict)
                            )
                            if not member_exists:
                                collab["active_members"].append(member_info)
                                collab["members_initialized"] = True
                                collaborators[idx] = collab
                            break
        elif is_pi:
            if "active_members" not in current_user or not isinstance(current_user["active_members"], list):
                current_user["active_members"] = []

            current_user["active_members"].append({
                "first_name": new_collab.get("first_name", ""),
                "last_name": new_collab.get("last_name", ""),
                "email": new_collab.get("primary_email", "")
            })

            # Update PI row back in collaborators
            for i, c in enumerate(collaborators):
                if (c.get("primary_email") or "").lower() == user_email:
                    collaborators[i] = current_user
                    break
        update_s3_collaborators_csv(collaborators)

        return jsonify({"message": "Collaborator added successfully"}), 201

    except Exception as e:
        print(f"Error in add_collaborator: {e}")
        return jsonify({"message": "Internal server error"}), 500
    

def get_all_collaborators(request):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    try:
        decoded_token = request.decoded_token
        user_email = decoded_token.get("email")
        collaborators = get_collaborators_data()
        def safe_last_name(collab):
            return (collab.get("last_name") or "").lower()
        collaborators.sort(key=safe_last_name)
        formatted = [format_for_table(c) for c in collaborators]
        if is_admin(decoded_token):
            return jsonify(formatted), 200
        user_row = next((c for c in collaborators if c.get("primary_email") == user_email), None)
        if not user_row:
            return jsonify({"message": "User not found"}), 404

        user_role = user_row.get("role", "Member")
        #user_cohorts = user_row.get("cohort_enigma_list", [])
        user_last_name = user_row.get("last_name", "")
        if user_role in ["PI", "Co-PI"]:
            filtered = []
            # Get all member emails from PI's active and former lists
            active_members = user_row.get("active_members", [])
            former_members = user_row.get("former_members", [])
            member_emails = set()
            for member in active_members:
                if isinstance(member, dict):
                    email = (member.get("email") or "").lower()
                    if email:
                        member_emails.add(email)
            
            for member in former_members:
                if isinstance(member, dict):
                    email = (member.get("email") or "").lower()
                    if email:
                        member_emails.add(email)
            for c in collaborators:
                c_email = c.get("primary_email", "").lower()
                # Include the PI themselves
                if c_email == user_email.lower():
                    filtered.append(c)
                    continue
                # Include if member is in PI's active or former lists
                if c_email in member_emails:
                    filtered.append(c)
                    continue
                c_pi_last_name_list = c.get("pi_last_name", [])
                if isinstance(c_pi_last_name_list, str):
                    c_pi_last_name_list = [c_pi_last_name_list] if c_pi_last_name_list else []
                c_pi_last_names_lower = [pi.strip().lower() for pi in c_pi_last_name_list if pi]
                if user_last_name in c_pi_last_names_lower:
                    filtered.append(c)
            
            return jsonify([format_for_table(c) for c in filtered]), 200

        return jsonify([format_for_table(user_row)]), 200
    except Exception as e:
        print("Error in get_all_collaborators:", e)
        return jsonify({"message": "Internal server error"}), 500

def download_collaborators_csv(request):
    try:
        decoded_token = request.decoded_token
        
        if not is_admin(decoded_token):
            return jsonify({"message": "Only admins can download CSV"}), 403
        
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY,
            region_name="us-east-1",
        )
        
        response = s3_client.get_object(
            Bucket=COLLABORATORS_BUCKET,
            Key=COLLABORATORS_KEY
        )
        
        csv_content = response['Body'].read().decode('utf-8')
        
        return Response(
            csv_content,
            mimetype="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=collaborators.csv"
            }
        )
        
    except Exception as e:
        print(f"Error downloading CSV from S3: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Internal server error"}), 500
    
def get_cohort_members(pi_last_name: str, all_collaborators: List[dict], exclude_email: str = None) -> List[dict]:
    members = []
    exclude_email_lower = (exclude_email or "").lower()
    pi_last_name_lower = pi_last_name.strip().lower()
    
    for collab in all_collaborators:
        collab_email = (collab.get("primary_email") or "").lower()
        
        if collab_email == exclude_email_lower:
            continue

        member_pi_list = collab.get("pi_last_name", [])
        if isinstance(member_pi_list, str):
                    member_pi_list = [member_pi_list] if member_pi_list else []
        has_matching_pi = any(pi.strip().lower() == pi_last_name_lower 
            for pi in member_pi_list if pi)
        
        if has_matching_pi:
            members.append({
                "first_name": collab.get("first_name", ""),
                "last_name": collab.get("last_name", ""),
                "email": collab.get("primary_email", ""),
                "role": collab.get("role", "Member"),
            })
    return members

def get_members_by_cohort_and_pi(request):
    try:
        collaborators = get_collaborators_data()
        
        cohort_members_map = {}
        
        for collab in collaborators:
            if collab.get("role") in ["PI", "Co-PI"]:
                pi_first_name = collab.get('first_name', '')
                pi_last_name = collab.get('last_name', '')
                pi_name = f"{pi_first_name} {pi_last_name}".strip()
                pi_role = collab.get('role', '')
                
                cohort_contributors = collab.get("cohort_contributors", [])
                
                for cohort_data in cohort_contributors:
                    if isinstance(cohort_data, dict):
                        cohort_name = cohort_data.get("cohort", "").strip()
                        members = cohort_data.get("members", [])
                        
                        if cohort_name:
                            if cohort_name not in cohort_members_map:
                                cohort_members_map[cohort_name] = []
                            
                            # Only add if there are members
                            if members:
                                cohort_members_map[cohort_name].append({
                                    "pi_name": pi_name,
                                    "role": pi_role,
                                    "members": members
                                })
        
        return jsonify(cohort_members_map), 200
        
    except Exception as e:
        print(f"Error in get_members_by_cohort_and_pi: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Internal server error"}), 500

def get_last_updated(request):
    try:
        collaborators = get_collaborators_data()
        
        if not collaborators:
            return jsonify({"last_updated": None}), 200
        
        most_recent = None
        for collab in collaborators:
            timestamp_str = collab.get("timestamp", "")
            if timestamp_str:
                try:
                    dt = datetime.datetime.fromisoformat(timestamp_str)
                    if most_recent is None or dt > most_recent:
                        most_recent = dt
                except (ValueError, TypeError):
                    continue
        
        if most_recent:
            return jsonify({
                "last_updated": most_recent.isoformat()
            }), 200
        else:
            return jsonify({"last_updated": None}), 200
            
    except Exception as e:
        print(f"Error getting last updated: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Internal server error"}), 500


def format_for_table(row):
    formatted = dict(row)
    is_active = row.get("is_active", True)
    formatted.update({
        "index": row.get("index", ""),
        "first_name": row.get("first_name", ""),
        "last_name": row.get("last_name", ""),
        "email": row.get("primary_email", ""),
        "role": row.get("role", "Member"), 
        "is_active": "true" if is_active else "false",  
        "University/Institute": (
            row["university_list"][0]
            if isinstance(row.get("university_list"), list) and row["university_list"]
            else ""
        ),
    })
    return formatted

def get_admins(request):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    try:
        decoded_token = request.decoded_token
        if not is_admin(decoded_token):
            return jsonify({"message": "Forbidden"}), 403

        admins = get_admins_list()
        return jsonify({"admins": admins}), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": "Internal server error"}), 500

def add_admin(request):
    try:
        decoded_token = request.decoded_token
        if not is_admin(decoded_token):
            return jsonify({"message": "Forbidden"}), 403

        # Get the email of the new admin from the request body
        data = request.get_json()
        if not data or "email" not in data:
            return jsonify({"message": "Invalid request body"}), 400

        new_admin_email = data["email"]

        # Get current admins
        s3 = boto3.client(
            "s3",
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY,
            region_name="us-east-1",
        )
        obj = s3.get_object(Bucket=ADMINS_BUCKET, Key=ADMINS_KEY)
        data = obj["Body"].read().decode("utf-8").splitlines()
        reader = csv.DictReader(data)
        admins = list(reader)

        # Check if the email is already an admin
        for admin in admins:
            if admin["email"] == new_admin_email:
                return jsonify({"message": "User is already an admin"}), 400

        # Add the new admin
        admins.append({"email": new_admin_email})

        # Write back to S3
        fieldnames = ["email"]
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(admins)
        csv_data = output.getvalue()

        s3.put_object(
            Bucket=ADMINS_BUCKET, Key=ADMINS_KEY, Body=csv_data.encode("utf-8")
        )

        return jsonify({"message": "Admin added successfully"}), 200

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": "Internal server error"}), 500


def delete_admin(request):
    try:
        decoded_token = request.decoded_token
        if not is_admin(decoded_token):
            return jsonify({"message": "Forbidden"}), 403

        data = request.get_json()
        if not data or "email" not in data:
            return jsonify({"message": "Invalid request body"}), 400

        admin_email = data["email"]
        admins = get_admins_list()

        # Remove the admin if they exist
        if admin_email not in admins:
            return jsonify({"message": "Admin not found"}), 404

        updated_admins = [{"email": email} for email in admins if email != admin_email]
        update_s3_csv(ADMINS_BUCKET, ADMINS_KEY, updated_admins, ["email"])

        return jsonify({"message": "Admin deleted successfully"}), 200

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": "Internal server error"}), 500
    

def check_admin_status(request):
    try:
        decoded_token = request.decoded_token
        is_user_admin = is_admin(decoded_token)
        return jsonify({"is_admin": is_user_admin}), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": "Internal server error"}), 500

def send_invite_email(request):
    """
    Send an invitation email to a new member who doesn't exist in the system yet.
    """
    try:
        decoded_token = request.decoded_token
        user_email = (decoded_token.get("email") or "").lower()
        
        # Check if user is PI or Admin
        admin = is_admin(decoded_token)
        if not admin:
            collaborators = get_collaborators_data()
            current_user = next(
                (c for c in collaborators if (c.get("primary_email") or "").lower() == user_email),
                None
            )
            if not current_user or current_user.get("role") != "PI":
                return jsonify({"message": "Only PIs and Admins can send invites"}), 403

        data = request.get_json()
        if not data or "email" not in data:
            return jsonify({"message": "Invalid request body"}), 400

        invite_email = data["email"]
        sender_name = data.get("sender_name", "ENIGMA Team")
        subject = "Invitation to Join ENIGMA Collaborators"
        body = f'''
        Hello,
        
        You have been invited to join the ENIGMA Collaborators directory.
        To create your profile and join the team.

        If you have any questions, please contact the ENIGMA team.
        
        Best regards,
        ENIGMA Team
        '''
        success = send_email(
            recipient=invite_email,
            subject=subject,
            body=body
        )
        if success:
            print(f"Invitation email sent successfully to {invite_email}")
            return jsonify({"message": "Invitation email sent successfully"}), 200
        else:
            print(f"Failed to send invitation email to {invite_email}")
            return jsonify({"message": "Failed to send invitation email"}), 500

    except Exception as e:
        print(f"Error sending invite email: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Internal server error"}), 500


def check_collaborator_by_email(request):
    """
    Check if a collaborator exists by email address.
    Returns their basic info if they exist.
    """
    try:
        email = request.args.get("email")
        if not email:
            return jsonify({"message": "Email parameter is required"}), 400
        
        email = email.lower().strip()
        collaborators = get_collaborators_data()
        
        for collab in collaborators:
            collab_email = (collab.get("primary_email") or "").lower()
            # Also check in email_list
            email_list = collab.get("email_list", [])
            if isinstance(email_list, str):
                try:
                    email_list = json.loads(email_list)
                except:
                    email_list = [email_list]
            
            if collab_email == email or email in [e.lower() for e in email_list]:
                return jsonify({
                    "exists": True,
                    "first_name": collab.get("first_name", ""),
                    "last_name": collab.get("last_name", ""),
                    "email": collab.get("primary_email", ""),
                    "role": collab.get("role", "Member"),
                    "index": collab.get("index", ""),
                }), 200
        
        return jsonify({"exists": False}), 200
        
    except Exception as e:
        print(f"Error checking collaborator: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Internal server error"}), 500

def _build_cors_preflight_response():
    response = jsonify({"status": "success"})
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    response.headers.add("Access-Control-Max-Age", "10000")
    response.headers.add(
        "Access-Control-Allow-Headers", "Content-Type,Authorization, X-Requested-With"
    )
    return response


if __name__ == "__main__":
    application.run(port=5000, debug=True)
