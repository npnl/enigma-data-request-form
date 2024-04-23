from collections import defaultdict
import os
import json

working_dir = os.getcwd().split('/faculty')[0]
metrics_dir = f'{working_dir}/faculty/sliew/enigma/new/infodb/metrics'
metric_paths = [os.path.join(metrics_dir, file)
                for file in os.listdir(metrics_dir)]

categories = defaultdict(list)
for path in metric_paths:
	with open(path, 'r') as f:
		metric = json.load(f)
		categories[str(metric['category']).strip()].append({"metric_name": str(metric['metric_name']).strip(),
                                         "variable_type": str(metric['variable_type']).strip(),
                                         "description": str(metric['description']).strip()
					 })
for category in categories:
    categories[category] = sorted(categories[category], key=lambda x: x['metric_name'])
	
categories = dict(sorted(categories.items()))
	
with open(os.getcwd() + '/metrics_data.json', 'w') as outfile:
    json.dump(categories, outfile, indent=4)
