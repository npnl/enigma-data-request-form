import pandas as pd
import numpy as np
import glob as glob
import os
import json
import shutil, math
from concurrent.futures import ThreadPoolExecutor


working_dir = '/Volumes/faculty'.split('/faculty')[0]

def file_exists(args):
    path, index, col_name = args
    files = glob.glob(path)
    return index, col_name, files[0] if files else None

def get_file_path(row, img_type, working_dir):
    base_path = f"{working_dir}/faculty/sliew/enigma/new/BIDS/"
    derivatives_base = f"{working_dir}/faculty/sliew/enigma/new/BIDS/derivatives/"
    
    if img_type in ['T1', 'T2']:
        return f"{base_path}/{row['SITE']}/{row['BIDS_ID']}/{row['SES']}/anat/{row['BIDS_ID']}_{row['SES']}_{img_type}w.nii.gz"
    elif img_type == 'FLAIR':
        return f"{base_path}/{row['SITE']}/{row['BIDS_ID']}/{row['SES']}/anat/{row['BIDS_ID']}_{row['SES']}_{img_type}.nii.gz"
    elif img_type == 'DWI':
        return f"{base_path}/{row['SITE']}/{row['BIDS_ID']}/{row['SES']}/dwi/{row['BIDS_ID']}_{row['SES']}_dwi.nii.gz"
    elif img_type == 'Raw_Lesion':
        return f"{derivatives_base}lesion_raw/{row['SITE']}/{row['BIDS_ID']}/{row['SES']}/anat/*T1lesion_mask.nii.gz"
    elif img_type == 'MNI_T1':
        return f"{derivatives_base}lesion_preproc/{row['SITE']}/{row['BIDS_ID']}/{row['SES']}/anat/*T1FinalResampledNorm.nii.gz"
    elif img_type == 'MNI_Lesion_mask':
        return f"{derivatives_base}lesion_preproc/{row['SITE']}/{row['BIDS_ID']}/{row['SES']}/anat/*T1lesion_mask.nii.gz"
    else:
        # Handle any other types or return None if the img_type is unexpected
        print(f"Unrecognized image type: {img_type}")
        return None


def filter_imaging_data(imaging_filters, all_df):
    executor = ThreadPoolExecutor(max_workers=10)
    futures = []

    for i, row in all_df.iterrows():
        for img_type in imaging_filters.keys():
            path = get_file_path(row, img_type, working_dir)
            if path:
                futures.append(executor.submit(file_exists, (path, i, img_type)))

    for future in futures:
        index, col_name, file_path = future.result()
        if file_path:
            print(index, col_name, file_path, ' found')
            all_df.at[index, col_name + '_in_BIDS'] = file_path
        else:
            all_df.at[index, col_name + '_in_BIDS'] = '0'

    # Filtering logic based on your requirements
    for key, value in imaging_filters.items():
        if value['required']:
            all_df = all_df[all_df[key + '_in_BIDS'] != 'Not found']

    return all_df

    
def get_site(val):
    if pd.isnull(val):
        return val
    return val[4:8].upper()

def read_data(filepath):
    data = pd.read_csv(filepath, index_col=False, low_memory=False)
    return data

def write_data(filepath, data):
    data.to_csv(filepath, index=False)
    

def get_all_cols():
    try:
        with open('metrics_data.json', 'r') as file:
            data = json.loads(file.read())
            # print(data)
            cols_of_interest = set()
            for _, category in data.items():
                for categoryList in category:
                    cols_of_interest.add(categoryList['metric_name'])
            return cols_of_interest
    except FileNotFoundError:
        return []
    
def get_all_behavior_data(cols_of_interest):
    files = glob.glob(f'{working_dir}/faculty/sliew/enigma/new/octavio/behavior_renamed_20240126/*behavior_renamed.csv')
    all_df = pd.DataFrame([])
    for file in sorted(files):
        if 'all_behavior_renamed' in file:
            continue
        data = read_data(file)
        cols = [col for col in cols_of_interest if col in data.columns]
        proposal_data = data[cols].copy()
        proposal_data['SITE'] = proposal_data['BIDS_ID'].apply(get_site)
        proposal_data['SESSION_ID'] = proposal_data['BIDS_ID']+'_'+ proposal_data['SES']
        all_df = pd.concat([all_df, proposal_data])
    
    all_df = all_df.drop_duplicates(subset=['SESSION_ID'], ignore_index=True)
    all_df = all_df.reset_index(drop=True)
    return all_df

def add_images(all_df):
    filters = {}
    filters['T1'] = {'required': False}
    filters['T2'] = {'required': False}
    filters['DWI'] = {'required': False}
    filters['FLAIR'] = {'required': False}
    filters['Raw_Lesion'] = {'required': False}
    filters['MNI_T1'] = {'required': False}
    filters['MNI_Lesion_mask'] = {'required': False}
    all_df = filter_imaging_data(filters, all_df)
    return all_df
    
def generate_all_data():
    all_cols = get_all_cols()
    all_df = get_all_behavior_data(all_cols)
    imaging_filters = {
        'T1': {'required': False},
        'T2': {'required': False},
        'DWI': {'required': False},
        'FLAIR': {'required': False}, 
        'Raw_Lesion' : {'required': False},
        'MNI_T1' : {'required': False},
        'MNI_Lesion_mask': {'required': False}
    }
    all_df = filter_imaging_data(imaging_filters, all_df)

def replace_zero(all_df, cols):
    for col in cols:
        all_df[col] = all_df[col].replace(0, np.nan)
        all_df[col] = all_df[col].replace(0.0, np.nan)
        all_df[col] = all_df[col].replace('0', np.nan)
    return all_df


def main():
    # Replace imaging cols' 0 to nan values
    all_df = read_data('all_data.csv')
    all_df = replace_zero(all_df, [col for col in all_df.columns if 'in_BIDS' in col])
    write_data('all_data.csv', all_df)

    all_df = read_data('all_data.csv')

    columns_to_convert = list(all_df.columns)
    columns_to_convert.remove('SESSION_ID')

    for col in columns_to_convert:
        all_df[col] = all_df[col].notnull().astype(int)
    
    write_data('tmp_anonymized_data.csv', all_df)

    # Convert session_id to indices
    all_df = read_data('tmp_anonymized_data.csv')
    sessionIDs = list(all_df['SESSION_ID'])
    subjectIDIndices = {}
    sessionID_mappings = {}
    for sessionID in sessionIDs:
        if not sessionID or not pd.notna(sessionID):
            continue
        subjectID, sessionNum = sessionID.split('_ses-')
        if subjectID not in subjectIDIndices:
            subjectIDIndices[subjectID] = len(subjectIDIndices)
        sessionID_mappings[sessionID] = f"{subjectIDIndices[subjectID]}_{sessionNum}"
    all_df['SESSION_ID'] = all_df['SESSION_ID'].replace(sessionID_mappings)
    write_data('tmp_subj_anonymized_data.csv', all_df)

    all_df = read_data('tmp_subj_anonymized_data.csv')
    all_df = all_df.replace(0, np.nan)
    write_data('anonymized_data.csv', all_df)
    # all_df_json = all_df.to_dict(orient='records')
    # with open(os.getcwd() + '/boolean_data.json', 'w') as outfile:
    #     json.dump(all_df_json, outfile, indent=4)


if __name__ == "__main__":
    main()
