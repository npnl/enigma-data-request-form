# enigma-data-request-form
python3 -m venv venv
.\venv\Scripts\activate
source venv/bin/activate
pip install -r requirements.txt
cd react-data-request-form
npm run build 
cd ..
flask --app application run --debug

