from flask import (
    Flask,
    render_template,
    send_from_directory,
    request,
    jsonify,
    session,
    url_for,
    Response,
)
from flask_cors import CORS, cross_origin  # Import CORS
import json, os
from utils import (
    fetch_data,
    get_filtered_rows_count,
    add_data_request,
    get_request_data_from_storage,
    get_requests,
    get_summarized_data,
    send_email,
    get_boolean_data_from_file,
    get_authors_list,
    get_formatted_authors_response,
    fetch_pdf_data,
    fetch_qc_data,
    update_qc_csv_data,
)

import collaborators_utils 


app_mode = os.getenv("FLASK_APP_MODE", "user")
application = Flask(__name__, static_folder="static/build")
# CORS(application, resources={r"/*": {"origins": "http://localhost:3000"}})
CORS(application)


@application.route("/config", methods=["GET"])
@cross_origin()
def get_config():
    return jsonify({"mode": app_mode}), 200


@application.route("/view", methods=["POST"])
def view_data():
    if app_mode == "admin":
        data = request.data
        filters = json.loads(data)
        result = fetch_data(filters["data"])

        if result["success"]:
            if "data" in result:
                return jsonify(
                    {
                        "status": "success",
                        "data": result["data"],
                        "redirect_url": url_for("display"),
                    }
                )
            else:
                return jsonify({"status": "success"})
        else:
            error_message = result.get("error", "An error has occurred")
            return jsonify({"error": error_message}), 500
    else:
        return jsonify({"error": "Invalid operation"}), 401


@application.route("/download", methods=["POST"])
@cross_origin()
def download_data():
    if app_mode == "admin":
        data = request.data
        filters = json.loads(data)
        result = fetch_data(filters["data"], download=True)

        if result["success"] and "data" in result:
            csv = result["data"]
            response = Response(csv, mimetype="text/csv")
            response.headers["Content-Disposition"] = "attachment; filename=data.csv"
            return response
        elif result["success"]:
            return Response(
                json.dumps({"error": "No data was fetched"}),
                status=404,
                mimetype="application/json",
            )
        else:
            error_message = result.get("error", "An error has occurred")
            return Response(
                json.dumps({"error": error_message}),
                status=500,
                mimetype="application/json",
            )
    else:
        return jsonify({"error": "Invalid operation"}), 401


@application.route("/rows-count", methods=["POST", "OPTIONS"])
@cross_origin()
def get_rows_count():
    if request.method == "OPTIONS":
        # Specific handling for preflight request if needed
        return _build_cors_preflight_response()
    filters = json.loads(request.data)
    print(filters)
    result = get_filtered_rows_count(application.static_folder, filters)

    if result["success"] and "count" in result:
        return jsonify({"count": result["count"]}), 200
    return jsonify({"error": "Error"}), 500


@application.route("/boolean-data", methods=["GET", "OPTIONS"])
@cross_origin()
def get_boolean_data():
    if request.method == "OPTIONS":
        # Specific handling for preflight request if needed
        return _build_cors_preflight_response()
    staticPath = application.static_folder
    result = get_boolean_data_from_file(staticPath)
    return result


@application.route("/metrics", methods=["GET", "OPTIONS"])
@cross_origin()
def get_metrics():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    try:
        with open(application.static_folder + "/anonymized_data/metrics_data.json", "r") as file:
            behavioral_data = json.loads(file.read())
            data = {
                "behavioral": behavioral_data,
                "imaging": [
                    "T1",
                    "T2",
                    "DWI",
                    "FLAIR",
                    "Native_Lesion",
                    "MNI_T1",
                    "MNI_Lesion_Mask",
                ],
            }
        return data, 200
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404


@application.route("/get-results", methods=["GET"])
@cross_origin()
def get_results():
    if "result_data" in session:
        return jsonify(session["result_data"])
    return jsonify({"error": "No data found"}), 404


@application.route("/submit-request", methods=["POST"])
@cross_origin()
def submit_request():
    data = json.loads(request.data)
    response = add_data_request(data)
    if response["success"]:
        return jsonify({"status": "success", "message": response["message"]}), 200
    else:
        return (
            jsonify(
                {
                    "error": "There was an error submitting your request",
                    "message": response["message"],
                }
            ),
            500,
        )


@application.route("/get-requests", methods=["GET", "OPTIONS"])
@cross_origin()
def fetch_requests():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    if app_mode == "admin":
        files_data = get_requests()
        print(files_data)
        return jsonify(files_data), 200
    else:
        return jsonify({"error": "Invalid operation"}), 401


@application.route("/get-request/<filename>")
@cross_origin()
def get_request_data(filename):
    if app_mode == "admin":
        data = get_request_data_from_storage(filename)
        return data, 200
    else:
        return jsonify({"error": "Invalid operation"}), 401


@application.route("/data-summary", methods=["POST"])
@cross_origin()
def get_data_and_summary():
    response = {}
    if app_mode == "admin":
        data = json.loads(request.data)
        response = get_summarized_data(data)
        json_data = json.dumps(response, default=str)
        return json_data, 200
    else:
        return jsonify({"error": "Invalid operation"}), 401


@application.route("/data-summary/<filename>")
@cross_origin()
def get_data_and_summary_by_filename(filename):
    response = {}
    if app_mode == "admin":
        data_request = get_request_data_from_storage(filename)
        response = get_summarized_data(data_request["data"])
        json_data = json.dumps(response, default=str)
        return json_data, 200
    else:
        return jsonify({"error": "Invalid operation"}), 401


@application.route("/send-email", methods=["GET"])
@cross_origin()
def send_email_to():
    print("sending")
    response = send_email("lmuthyal@usc.edu")
    return jsonify({"error": "Invalid operation", "response": response}), 200


@application.route("/get-authors-list", methods=["GET", "OPTIONS"])
@cross_origin()
def fetch_authors_list():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    if app_mode == "admin":
        response = get_authors_list()
        # json_data = json.dumps(response, default=str)
        return response["data"], 200
    else:
        return jsonify({"error": "Invalid operation"}), 401


@application.route("/formatted-authors", methods=["POST", "OPTIONS"])
@cross_origin()
def get_formatted_authors():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    if app_mode == "admin":
        request_data = json.loads(request.data)
        response_txt = get_formatted_authors_response(request_data)
        return jsonify({"formattedAuthors": response_txt}), 200


@application.route("/qc-pdf-data/<bids_id>/<ses_id>", methods=["GET"])
@cross_origin()
def get_qc_pdf(bids_id, ses_id):
    return fetch_pdf_data(bids_id, ses_id)


@application.route("/qc-data", methods=["GET"])
@cross_origin()
def get_qc_subjects_data():
    return fetch_qc_data(), 200


@application.route("/qc-pdf-data/<bids_id>/<ses_id>", methods=["POST"])
@cross_origin()
def update_qc_data(bids_id, ses_id):
    data = json.loads(request.data)
    res = update_qc_csv_data(bids_id, ses_id, data)
    if res:
        return jsonify({"success": True}), 200
    return jsonify({"success": False}), 500

@application.route("/collaborators/get_user_details", methods=["GET", "OPTIONS"])
@cross_origin()
@collaborators_utils.authenticate
def get_user_details():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    return collaborators_utils.get_user_details(request)


@application.route("/collaborators/update_user_details", methods=["POST", "OPTIONS"])
@cross_origin()
@collaborators_utils.authenticate
def update_user_details():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    return collaborators_utils.update_user_details(request)

@application.route("/collaborators/delete_collaborator", methods=["DELETE", "OPTIONS"])
@cross_origin()
@collaborators_utils.authenticate
def delete_collaborator():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    return collaborators_utils.delete_collaborator(request)

@application.route("/collaborators/add_collaborator", methods=["POST", "OPTIONS"])
@cross_origin()
@collaborators_utils.authenticate
def add_collaborator():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    return collaborators_utils.add_collaborator(request)

@application.route("/collaborators/get_all_collaborators", methods=["GET", "OPTIONS"])
@cross_origin()
@collaborators_utils.authenticate
def get_all_collaborators():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    return collaborators_utils.get_all_collaborators(request)

@application.route("/collaborators/get_admins", methods=["GET", "OPTIONS"])
@cross_origin()
@collaborators_utils.authenticate
def get_admins():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    return collaborators_utils.get_admins(request)

@application.route("/collaborators/add_admin", methods=["POST", "OPTIONS"])
@cross_origin()
@collaborators_utils.authenticate
def add_admin():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    return collaborators_utils.add_admin(request)

@application.route("/collaborators/delete_admin", methods=["DELETE","OPTIONS"])
@cross_origin()
@collaborators_utils.authenticate
def delete_admin():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    return collaborators_utils.delete_admin(request)

@application.route("/collaborators/check_admin_status", methods=["GET", "OPTIONS"])
@cross_origin()
@collaborators_utils.authenticate
def check_admin_status():
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()
    return collaborators_utils.check_admin_status(request)


def _build_cors_preflight_response():
    response = jsonify({"status": "success"})
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    response.headers.add("Access-Control-Max-Age", "10000")
    response.headers.add(
        "Access-Control-Allow-Headers", "Content-Type,Authorization, X-Requested-With"
    )
    return response

@application.route("/", defaults={"path": ""})
@application.route("/<path:path>")
@cross_origin()
def form(path):
    if path != "" and os.path.exists(os.path.join(application.static_folder, path)):
        return send_from_directory(application.static_folder, path)
    else:
        return send_from_directory(application.static_folder, 'index.html')

if __name__ == "__main__":
    application.run(debug=True)
