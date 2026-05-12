import pandas as pd
import numpy as np
import glob as glob
import os
import json
import re
from datetime import datetime


working_dir = os.getcwd().split('/faculty')[0]
project_root = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(project_root, "../static/anonymized_data")


def read_data(filepath):
    data = pd.read_csv(filepath, index_col=False, low_memory=False)
    return data


def get_latest_inventory_file(inventory_dir):
    file_pattern = r"ENIGMA_inventory_all_(\d{4}-\d{2}-\d{2})"
    all_files = [f for f in os.listdir(inventory_dir) 
                 if re.search(file_pattern, f)]
    if not all_files:
        raise FileNotFoundError()
    all_files.sort(key=lambda f: datetime.strptime
                   (re.search(file_pattern, f).group(1),'%Y-%m-%d'))
    latest_file = all_files[-1]
    return latest_file


def get_inventory_data(inventory_csv_path, cols_of_interest):
    data = read_data(inventory_csv_path)
    all_df = pd.DataFrame([])
    cols = [col for col in cols_of_interest if col in data.columns]
    all_df = data[cols].copy()
    all_df = all_df.drop_duplicates(subset=['SESSION_ID'], ignore_index=True)
    all_df = all_df.reset_index(drop=True)
    return all_df

def write_data(filepath, data):
    data.to_csv(filepath, index=False)
    
project_root = os.path.dirname(os.path.abspath(__file__))
metrics_path = os.path.join(project_root, "../static/anonymized_data/metrics_data.json")
def get_all_cols():
    try:
        with open(metrics_path, 'r') as file:
            data = json.loads(file.read())
            cols_of_interest = set()
            for _, subcategories in data.items():
                if isinstance(subcategories, dict):
                    for _,metrics in subcategories.items():
                        for metric in metrics:
                            cols_of_interest.add(metric['metric_name'])
                else:
                    for metric in subcategories:
                        cols_of_interest.add(metric['metric_name'])
            ALWAYS_INCLUDE_COLS = {'SESSION_ID', 'SITE', 'BIDS_ID', 'SES'}
            cols_of_interest.update(ALWAYS_INCLUDE_COLS)
            return cols_of_interest
    except FileNotFoundError:
        return []

    
def generate_all_data():
    inventory_dir = f"{working_dir}/faculty/sliew/enigma/new/infodb/info/details/"
    all_cols = get_all_cols()
    latest_inventory = get_latest_inventory_file(inventory_dir)
    latest_inventory_path = os.path.join(inventory_dir, latest_inventory)
    all_df = get_inventory_data(latest_inventory_path, all_cols)
    write_data('all_data.csv', all_df)

def replace_zero(all_df, cols):
    for col in cols:
        all_df[col] = all_df[col].replace(0, np.nan)
        all_df[col] = all_df[col].replace(0.0, np.nan)
        all_df[col] = all_df[col].replace('0', np.nan)
    return all_df


def main():
    generate_all_data()
    all_df = read_data('all_data.csv')
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
    anonymized_path = os.path.join(static_dir, "anonymized_data.csv")
    write_data(anonymized_path, all_df)

if __name__ == "__main__":
    main()
