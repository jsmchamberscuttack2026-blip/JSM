from pymongo import MongoClient
import os

MONGO_URI="mongodb+srv://arnnavpanda2006_db_user:w52rYxHisbslJ4hp@cluster0.fxakspf.mongodb.net/?appName=Cluster0"
client = MongoClient(MONGO_URI)
db = client["jsmchambers_db"]
config = db['system_config'].find_one({"_id": "global_config"})
print("GLOBAL CONFIG:", config)
