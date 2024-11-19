from flask import Flask, request, jsonify
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

application = Flask(__name__)
CORS(application)

# Configuration variables
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "collaborator-dir")
S3_SECRET_KEY = os.getenv("AWS_SECRET_KEY", None)
S3_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY", None)
COLLABORATORS_BUCKET = os.environ.get("COLLABORATORS_BUCKET", "collaborators-dir")
COLLABORATORS_KEY = os.environ.get("COLLABORATORS_KEY", "collaborators.csv")
ADMINS_BUCKET = os.environ.get("ADMINS_BUCKET", "collaborators-dir")
ADMINS_KEY = os.environ.get("ADMINS_KEY", "admins.csv")

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
    collaborators = list(reader)
   
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

# Helper function to update S3 CSV
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


def get_user_details(request):
    try:
        decoded_token = request.decoded_token
        user_email = decoded_token.get("email")
        if not user_email:
            return jsonify({"message": "Email not found in token"}), 400

        collaborators = get_collaborators_data()
        user_details = None
        for collaborator in collaborators:
            if collaborator["email"] == user_email:
                user_details = collaborator
                break

        if not user_details:
            return jsonify({"message": "User not found"}), 404

        return jsonify(user_details), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": "Internal server error"}), 500


def update_user_details(request):
    try:
        decoded_token = request.decoded_token
        user_email = decoded_token.get("email")
        if not user_email:
            return jsonify({"message": "Email not found in token"}), 400

        # Get the updated details from the request body
        user_updates = request.get_json()
        if not user_updates:
            return jsonify({"message": "Invalid request body"}), 400

        collaborator_email = user_updates.get("email")

        if not is_admin(decoded_token) and collaborator_email != user_email:
            return jsonify({"message": "Invalid request body"}), 405

        # Fetch current collaborators data
        collaborators = get_collaborators_data()
        user_updates["timestamp"] = datetime.datetime.now().isoformat()

        # Update the user's details
        user_found = False
        for collaborator in collaborators:
            if collaborator["email"] == collaborator_email:
                for key, value in user_updates.items():
                    if key in collaborator:
                        collaborator[key] = value
                user_found = True
                break

        if not user_found:
            return jsonify({"message": "User not found"}), 404

        # Save the updated data back to S3
        # Convert the collaborators list back to CSV
        fieldnames = collaborators[0].keys()
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(collaborators)
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

        return jsonify({"message": "User details updated successfully"}), 200

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": "Internal server error"}), 500


def delete_collaborator(request):
    try:
        decoded_token = request.decoded_token
        if not is_admin(decoded_token):
            return jsonify({"message": "Forbidden"}), 403

        data = request.get_json()
        if not data or "email" not in data:
            return jsonify({"message": "Invalid request body"}), 400

        collaborator_email = data["email"]
        collaborators = get_collaborators_data()

        # Remove the collaborator if they exist
        updated_collaborators = [collab for collab in collaborators if collab["email"] != collaborator_email]

        if len(updated_collaborators) == len(collaborators):
            return jsonify({"message": "Collaborator not found"}), 404

        update_s3_csv(COLLABORATORS_BUCKET, COLLABORATORS_KEY, updated_collaborators, collaborators[0].keys())

        return jsonify({"message": "Collaborator deleted successfully"}), 200

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": "Internal server error"}), 500



def add_collaborator(request):
    try:
        decoded_token = request.decoded_token
        if not is_admin(decoded_token):
            return jsonify({"message": "Forbidden"}), 403

        collaborator_data = request.get_json()
        if not collaborator_data or "email" not in collaborator_data:
            return jsonify({"message": "Invalid request body"}), 400

        collaborators = get_collaborators_data()

        # Check if the collaborator already exists
        for collaborator in collaborators:
            if collaborator["email"] == collaborator_data["email"]:
                return jsonify({"message": "Collaborator already exists"}), 400
            
        max_index = max([int(collab["index"]) for collab in collaborators], default=0)
        collaborator_data["index"] = str(max_index + 1)
        collaborator_data["timestamp"] = datetime.datetime.now().isoformat()

        # Add the new collaborator
        collaborators.applicationend(collaborator_data)
        update_s3_csv(COLLABORATORS_BUCKET, COLLABORATORS_KEY, collaborators, collaborators[0].keys())

        return jsonify({"message": "Collaborator added successfully"}), 201

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": "Internal server error"}), 500
    
def get_all_collaborators(request):
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    try:
        decoded_token = request.decoded_token
        if not is_admin(decoded_token):
            return jsonify({"message": "Forbidden"}), 403

        collaborators = get_collaborators_data()
        return jsonify(collaborators), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": "Internal server error"}), 500


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
    application.run(port=5001, debug=True)
