from pymongo import MongoClient
import os

MONGO_URI="mongodb+srv://arnnavpanda2006_db_user:w52rYxHisbslJ4hp@cluster0.fxakspf.mongodb.net/?appName=Cluster0"
client = MongoClient(MONGO_URI)
db = client["jsmchambers_db"]
config = db['system_config'].find_one({"_id": "global_config"})
if config and 'appointment_settings' in config:
    settings = config['appointment_settings']
    if 'available_days' in settings:
        settings['available_days'] = list(set(settings['available_days']))
        db['system_config'].update_one({"_id": "global_config"}, {"$set": {"appointment_settings": settings}})
        print("Fixed duplicates in DB.")
