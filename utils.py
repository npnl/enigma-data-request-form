import pandas as pd
import numpy as np
import glob as glob
import os
import json
import boto3
from datetime import datetime
from enum import Enum
import boto3
from botocore.exceptions import ClientError
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


class RequestStatus(Enum):
    PENDING = 'pending'
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    FAILED = 'failed'

def getStatusType(status):
    if status == 'pending':
        return RequestStatus.PENDING
    elif status == 'completed':
        return RequestStatus.COMPLETED
    elif status == 'failed':
        return RequestStatus.FAILED
    return RequestStatus.IN_PROGRESS

working_dir = '/Volumes/faculty'.split('/faculty')[0]

app_mode = os.getenv('FLASK_APP_MODE', 'user')
BUCKET_NAME = os.getenv('AWS_DATA_BUCKET', None)
PROD_SECRET_KEY = os.getenv('AWS_SECRET_KEY', None)
PROD_ACCESS_KEY = os.getenv('AWS_ACCESS_KEY', None)
SMTP_USERNAME = os.getenv('SMTP_USERNAME', None)
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', None)

col_mapping = {
            'T1': 'T1_in_BIDS', 
            'T2' : 'T2_in_BIDS',
            'DWI' : 'DWI_in_BIDS',
            'FLAIR' : 'FLAIR_in_BIDS',
            'Native_Lesion': 'Raw_Lesion_in_BIDS', 
            'MNI_T1': 'MNI_T1_in_BIDS',
            'MNI_Lesion_Mask': 'MNI_Lesion_mask_in_BIDS'
        }

class BooleanData:
    _data = None
    # try:
    #     data = pd.read_csv('static/data/all_data_boolean_subj_with_ses.csv')
    # except:
    #     data = pd.DataFrame([])

    @classmethod
    def _get_data(cls, path):
        if cls._data is None:
            cls._data = pd.read_csv(path + '/data/all_data_boolean_subj_with_ses.csv')
        return cls._data

    @classmethod
    def removeNullRows(cls, cols):
        return cls.data.dropna(subset=cols)

    @classmethod
    def applyFiltersAndGetCount(cls, staticPath, cols, session='baseline'):
        data = cls._get_data(staticPath).dropna(subset=cols)
        if session == 'baseline':
            return len(data[data['SES'] == 'ses-1'])
        else:
            filtered_df = data[data['SES'].isin(['ses-1', 'ses-2'])]
            valid_bids_ids = filtered_df.groupby('BIDS_ID')['SES'].apply(lambda x: set(['ses-1', 'ses-2']).issubset(set(x)))
            data = filtered_df[filtered_df['BIDS_ID'].isin(valid_bids_ids[valid_bids_ids].index)]
            return len(data)
        # return data[data['SES'] == 'ses-1'] if session == 'baseline' else data



def get_data(behavior_filters):
    cols_of_interest = set(['BIDS_ID','SES','AGE','SEX'])
    for key in behavior_filters.keys():
        cols_of_interest.add(key)
    cols_of_interest = list(cols_of_interest)
    req_not_null = [key for key, value in behavior_filters.items() if value['required']]
    files = glob.glob(f'{working_dir}/faculty/sliew/enigma/new/octavio/behavior_renamed_20240126/*behavior_renamed.csv')
    all_df = pd.DataFrame([])
    for file in sorted(files):
        data = pd.read_csv(file, index_col=False)
        cols = [col for col in cols_of_interest if col in data.columns]
        proposal_data = data[cols].copy()
        all_df = pd.concat([all_df, proposal_data])
    
    all_df.insert(0,'SESSION_ID','')
    all_df['SESSION_ID'] = all_df['BIDS_ID']+'_'+ all_df['SES']
    all_df['SITE'] = all_df['BIDS_ID'].apply(get_site)
    all_df = all_df.drop_duplicates(subset=['SESSION_ID'], ignore_index=True)
    all_df = all_df.dropna(subset=req_not_null)
    all_df = all_df.reset_index(drop=True)

    for key, value in behavior_filters.items():
        if value['required']:
            min_val = None
            max_val = None
            
            if 'value1' in value and value['value1']:
                min_val = int(value['value1']) if value['type'] == 'int' else float(value['value1'])
            if 'value2' in value and value['value2']:
                max_val = int(value['value2']) if value['type'] == 'int' else float(value['value2'])

            if value['type'] == 'string':
                all_df = all_df.loc[all_df[key] == value['value1']]
            elif value['type'] in ['int', 'float']:
                if min_val is not None and max_val is not None:
                    all_df = all_df.loc[(all_df[key] >= min_val) & (all_df[key] <= max_val)]
                elif min_val is not None:
                    all_df = all_df.loc[all_df[key] >= min_val]
                elif max_val is not None:
                    all_df = all_df.loc[all_df[key] <= max_val]
            else:
                print(f"Invalid filter type for {key}: {value['type']}")

    return all_df


def filter_imaging_data(imaging_filters, all_df):
    if not len(all_df):
        return all_df
    for i,row in all_df.iterrows():
        if pd.isnull(row['BIDS_ID']) or pd.isna(row['BIDS_ID']) or pd.isnull(row['SES']):
            continue
        sub = row['BIDS_ID']
        ses = row['SES']
        site = sub[4:8].upper()
        path = f'{working_dir}/faculty/sliew/enigma/new/BIDS/{site}/{sub}/{ses}/'
        lesion_path = f'{working_dir}/faculty/sliew/enigma/new/BIDS/derivatives/lesion_raw/{site}/{sub}/{ses}/anat/'
        lesion_preproc = f'{working_dir}/faculty/sliew/enigma/new/BIDS/derivatives/lesion_preproc/{site}/{sub}/{ses}/anat/'
    
        T1 = path+'/anat/'+sub+"_"+ses+'_T1w.nii.gz'
        T2 = path+'/anat/'+sub+"_"+ses+'_T2w.nii.gz'
        DWI = path+'/dwi/'+sub+"_"+ses+'_dwi.nii.gz'
        FLAIR = path+'/anat/'+sub+"_"+ses+'_FLAIR.nii.gz'
        lesion = lesion_path+'*T1lesion_mask.nii.gz'
        MNI_T1 = lesion_preproc+'*T1FinalResampledNorm.nii.gz'
        MNI_mask = lesion_preproc+'*T1lesion_mask.nii.gz'
        if 'T1' in imaging_filters:
            T1_files = glob.glob(T1)
            T1_exists = T1_files[0] if T1_files else 0
            all_df.at[i, 'T1_in_BIDS'] = T1_exists
        if 'T2' in imaging_filters:
            T2_files = glob.glob(T2)
            T2_exists = T2_files[0] if T2_files else 0
            all_df.at[i, 'T2_in_BIDS'] = T2_exists
        if 'DWI' in imaging_filters:
            DWI_files = glob.glob(DWI)
            DWI_exists = DWI_files[0] if DWI_files else 0
            all_df.at[i,'DWI_in_BIDS'] = DWI_exists
        if 'FLAIR' in imaging_filters:
            FLAIR_files = glob.glob(FLAIR)
            FLAIR_exists = FLAIR_files[0] if FLAIR_files else 0
            all_df.at[i,'FLAIR_in_BIDS'] = FLAIR_exists
        if 'Raw_Lesion' in imaging_filters:
            lesion_files = glob.glob(lesion)
            lesion_exists = lesion_files[0] if lesion_files else 0
            all_df.at[i,'Lesion_Raw'] = lesion_exists
        if 'MNI_T1' in imaging_filters:
            MNI_T1_files = glob.glob(MNI_T1)
            MNI_T1_exists = MNI_T1_files[0] if MNI_T1_files else 0
            all_df.at[i, 'MNI_T1_in_BIDS'] = MNI_T1_exists
        if 'MNI_Lesion_mask' in imaging_filters:
            MNI_mask_files = glob.glob(MNI_mask)
            MNI_mask_exists = MNI_mask_files[0] if MNI_mask_files else 0
            all_df.at[i, 'MNI_mask_in_BIDS'] = MNI_mask_exists


    for key, value in imaging_filters.items():
        if value['required']:
            all_df=all_df.loc[all_df[col_mapping[key]] != 0]
    return all_df
    

def get_site(val):
    if pd.isnull(val):
        return val
    return val[4:8].upper()

def get_precomputed_data(timepoint, behavioralFilters, imagingFilters):
    all_df = pd.read_csv(f'{working_dir}/faculty/sliew/enigma/new/Lahari/ConsolidatedEnigmaData/all_data.csv')
    required_behavioral_metrics = [key for key, value in behavioralFilters.items() if value['required']]
    behavioral_metrics = ['BIDS_ID','SES','AGE','SEX', 'SITE'] + list(col_mapping.values())
    for key in behavioralFilters.keys():
        if key not in behavioral_metrics:
            behavioral_metrics.append(key)
    all_df = all_df[behavioral_metrics]
    all_df = all_df.dropna(subset=required_behavioral_metrics)

    for key, value in behavioralFilters.items():
        if value['required']:
            min_val = None
            max_val = None
            
            if 'value1' in value and value['value1'] and value['type'] in ['int', 'float']:
                min_val = int(value['value1']) if value['type'] == 'int' else float(value['value1'])
            if 'value2' in value and value['value2'] and value['type'] in ['int', 'float']:
                max_val = int(value['value2']) if value['type'] == 'int' else float(value['value2'])

            if value['type'] == 'string':
                if value['value1']:
                    all_df = all_df.loc[all_df[key] == value['value1']]
                else:
                    all_df = all_df.dropna(subset=key)
            elif value['type'] in ['int', 'float']:
                if min_val is not None and max_val is not None:
                    all_df = all_df.loc[(all_df[key] >= min_val) & (all_df[key] <= max_val)]
                elif min_val is not None:
                    all_df = all_df.loc[all_df[key] >= min_val]
                elif max_val is not None:
                    all_df = all_df.loc[all_df[key] <= max_val]
            else:
                print(f"Invalid filter type for {key}: {value['type']}")

    imaging_cols_to_drop = [col for key, col in col_mapping.items() if key not in imagingFilters]
    all_df = all_df.drop(columns=imaging_cols_to_drop)
    for key, value in imagingFilters.items():
        all_df[col_mapping[key]] = all_df[col_mapping[key]].replace(['0', '0.0'], np.nan)
        if value['required']:
            all_df=all_df.loc[all_df[col_mapping[key]].notna()]
    
    if timepoint == 'baseline':
        all_df = all_df[all_df['SES'] == 'ses-1']
    else:
        filtered_df = all_df[all_df['SES'].isin(['ses-1', 'ses-2'])]
        valid_bids_ids = filtered_df.groupby('BIDS_ID')['SES'].apply(lambda x: set(['ses-1', 'ses-2']).issubset(set(x)))
        all_df = filtered_df[filtered_df['BIDS_ID'].isin(valid_bids_ids[valid_bids_ids].index)]
    return all_df

def fetch_data(request, download=False):
    timepoint = request['timepoint'] if 'timepoint' in request else 'multi'
    imaging_lst = request['imaging']
    behavior_lst = request['behavior']
    try:
        # result = get_data(behavior_lst)
        # result = filter_imaging_data(imaging_lst, result)
        result = get_precomputed_data(timepoint, behavior_lst, imaging_lst)
        result.reset_index(inplace=True)
        if 'index' in result.columns:
            result.drop(columns='index', inplace=True)
        if len(result) > 0:
            if download:
                return {'success': True, 'data': result.to_csv(index=False)}
            return {'success': True, 'data' : result.to_json(orient='records')}
        else:
            return {'success': True}
    except Exception as e:
        print("An error occurred: ", str(e))
        return {'success': False}
    
def fetch_bool_data():
    with open(os.path.join(os.getcwd(), 'boolean_data.json'), 'r') as f:
        boolean_data = json.load(f)
        return {'success': True, 'data': boolean_data}

def get_filtered_rows_count(staticPath, filters):
    timepoint = filters['timepoint'] if 'timepoint' in filters else 'baseline'
    all_filters = filters['behavioral'] + [col_mapping[col] for col in filters['imaging']]
    count = BooleanData.applyFiltersAndGetCount(staticPath, all_filters, timepoint)
    return {'success': True, 'count': count}

def send_email(recipient):
    smtp_server = 'email-smtp.us-east-1.amazonaws.com'  
    port = 587  # TLS Port
    sender = 'npnlusc@gmail.com' 
    subject = 'Hello from Amazon SES'
    body = 'Hello, this is a test email sent from Amazon SES'
    msg = MIMEMultipart()
    msg['From'] = sender
    msg['To'] = recipient
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'plain'))

    try:
        # Create server object with SSL option
        server = smtplib.SMTP(smtp_server, port, timeout=10)
        server.starttls()  
        server.login(SMTP_USERNAME, SMTP_PASSWORD) 
        text = msg.as_string()  
        server.sendmail(sender, recipient, text)  
        server.quit()  
        print("Email sent successfully!")
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

def upload_file_to_s3(file_name, content, object_name=None):
    # If S3 object_name was not specified, use file_name
    if object_name is None:
        object_name = file_name

    # Upload the file
    s3_client = boto3.client('s3', aws_access_key_id=PROD_ACCESS_KEY, aws_secret_access_key=PROD_SECRET_KEY, region_name='us-east-1')
    # Local_Secret_key = GTXhqfbSAFyZZkxsLUWi2lb0LvaSyheHAypLJmF+
    #  Local_access_key = AKIATSAG2FXKXEKEOUUU
    try:
        response2 = s3_client.put_object(Bucket=BUCKET_NAME, Key='data-requests/' + object_name, Body=content)
        return True, "Success"
    except Exception as e:
        print(e)
        return False, str(e)


def add_data_request(data):
    try:
        requestor = data['requestor']['name']
        currentTime = datetime.now().strftime('%Y%m%d%H%M%S')
        fileName = f'{requestor}_{currentTime}.json'

        dataRequest = {
            'requestor': data['requestor'],
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'request': data,
            'status': "pending"
        }

        json_string = json.dumps(dataRequest).encode('utf-8')

        success, message = upload_file_to_s3(fileName, json_string)
        return {'success': success, 'message': message}
    except Exception as e:
        print(e)
        return {'success': False, 'message': str(e.args[0])}


def get_requests():
    PREFIX_DIR = 'data-requests/'
    s3_client = boto3.client('s3', aws_access_key_id=PROD_ACCESS_KEY, aws_secret_access_key=PROD_SECRET_KEY, region_name='us-east-1')
    response = s3_client.list_objects_v2(Bucket=BUCKET_NAME, Prefix=PREFIX_DIR)
    files = [file['Key'] for file in response.get('Contents', []) if file['Key'].endswith('.json')]
    file_data = []
    for file_key in files:
        file_content = s3_client.get_object(Bucket=BUCKET_NAME, Key=file_key)
        file_name = file_key.split(PREFIX_DIR)[1]
        file_text = file_content['Body'].read().decode('utf-8')
        file_json = json.loads(file_text)

        file_data.append({
            'file_name': file_name,
            'time': file_json['timestamp'],
            'name': file_json['requestor']['name'],
            'email': file_json['requestor']['email'],
            'data': file_json['request'],
            'status': (file_json['status'] if 'status' in file_json else 'pending').capitalize()
        })
    return file_data


def get_request_data_from_storage(filename):
    s3_client = boto3.client('s3', aws_access_key_id=PROD_ACCESS_KEY, aws_secret_access_key=PROD_SECRET_KEY, region_name='us-east-1')
    response = s3_client.list_objects_v2(Bucket=BUCKET_NAME, Prefix='data-requests/')
    file_key = f'data-requests/{filename}'
    response = s3_client.get_object(Bucket=BUCKET_NAME, Key=file_key)
    file_content = response['Body'].read().decode('utf-8')
    file_content = json.loads(file_content)
    data = {
        'file_name': filename,
            'time': file_content['timestamp'],
            'name': file_content['requestor']['name'],
            'email': file_content['requestor']['email'],
            'data': file_content['request'],
            'status': (file_content['status'] if 'status' in file_content else 'pending').capitalize()
    }
    # data = json.loads(file_content)
    return data

def get_imaging_data_summary(result, imagingFilters):
    if imagingFilters and len(result) > 0:
        imagingCols = ['SITE'] + [col_mapping[col] for col in imagingFilters.keys()]
        imagingDf = result[imagingCols]
        imagingDf.columns = [col.replace('_in_BIDS', '') for col in imagingDf.columns]
        aggregateDict = {}
        for col in imagingDf.columns:
            aggregateDict[col] = 'count'
        imagingDataBySite = imagingDf.groupby('SITE').agg(aggregateDict)
        imagingDataBySite.loc['Total'] = imagingDataBySite.sum(numeric_only=True)
        imagingDataBySite = imagingDataBySite.drop(columns=['SITE'])
        imagingDataBySite = imagingDataBySite.reset_index()
        return imagingDataBySite
    return pd.DataFrame({})

def get_records_by_site(result):
    if len(result) > 0:
        imaging_cols = [col for col in result.columns if col in col_mapping.values()]
        behavioral_df = result.drop(columns=imaging_cols)
        count_by_site = behavioral_df.groupby('SITE').size()
        count_by_site = count_by_site.reset_index()
        count_by_site = count_by_site.reindex(columns=['SITE', 0])
        count_by_site = count_by_site.rename(columns={0: 'Count'})
        return count_by_site
    return pd.DataFrame({})

def get_behavioral_data_summary(result):
    if len(result) > 0:
        imaging_cols = [col for col in result.columns if col in col_mapping.values()]
        behavioral_df = result.drop(columns=imaging_cols)
        cols_count_by_site = behavioral_df.count()
        cols_count_by_site = cols_count_by_site.reset_index()
        cols_count_by_site = cols_count_by_site.sort_values(by=cols_count_by_site.columns[0])
        cols_count_by_site = cols_count_by_site.reindex(columns=['index', 0])
        cols_count_by_site = cols_count_by_site.rename(columns={0: 'Count', 'index': 'Attribute'})
        return cols_count_by_site
    return pd.DataFrame({})

def validate_data(df):
    # Replace NaNs with None (which converts to null in JSON)
    df = df.where(pd.notnull(df), None)
    return df.astype(str).replace('nan', '').replace('None', '').to_dict(orient='records')

def get_summarized_data(request):
    timepoint = request['timepoint'] if 'timepoint' in request else 'multi'
    imaging_lst = request['imaging']
    behavior_lst = request['behavior']
    try:
        # result = get_data(behavior_lst)
        # result = filter_imaging_data(imaging_lst, result)
        result = get_precomputed_data(timepoint, behavior_lst, imaging_lst)
        imagingDataBySite = get_imaging_data_summary(result, imaging_lst)
        columnsSummary = get_behavioral_data_summary(result)
        recordsBySite = get_records_by_site(result)
        result.reset_index(inplace=True)
        if 'index' in result.columns:
            result.drop(columns='index', inplace=True)
        response = {}
        response['data'] = validate_data(result)
        response['imagingDataBySite'] = validate_data(imagingDataBySite)
        response['columnsSummary'] = validate_data(columnsSummary)
        response['recordsBySite'] = validate_data(recordsBySite)
        return response
    except Exception as e:
        print("An error occurred: ", str(e))
       
