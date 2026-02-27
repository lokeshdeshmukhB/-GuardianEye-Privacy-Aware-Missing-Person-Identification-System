from pymongo import MongoClient

client = MongoClient('mongodb://127.0.0.1:27017/')
db = client['missing_person_db']

# Clear existing data
db['missingpersons'].delete_many({})

# Insert sample missing persons
sample_cases = [
    {
        "caseId": "CASE001",
        "name": "John Smith",
        "age": 28,
        "gender": "Male",
        "lastSeenLocation": "Downtown Plaza",
        "status": "active",
        "description": "Missing since Feb 20",
        "thumbnailUrl": "/uploads/case1.jpg",
        "reidScore": 0.85,
        "attributeScore": 0.78,
        "gaitScore": 0.82,
        "fusionScore": 0.82
    },
    {
        "caseId": "CASE002",
        "name": "Sarah Johnson",
        "age": 25,
        "gender": "Female",
        "lastSeenLocation": "Central Station",
        "status": "active",
        "description": "Missing since Feb 22",
        "thumbnailUrl": "/uploads/case2.jpg",
        "reidScore": 0.79,
        "attributeScore": 0.81,
        "gaitScore": 0.75,
        "fusionScore": 0.79
    },
    {
        "caseId": "CASE003",
        "name": "Michael Brown",
        "age": 35,
        "gender": "Male",
        "lastSeenLocation": "Harbor Area",
        "status": "active",
        "description": "Missing since Feb 18",
        "thumbnailUrl": "/uploads/case3.jpg",
        "reidScore": 0.88,
        "attributeScore": 0.76,
        "gaitScore": 0.80,
        "fusionScore": 0.81
    },
    {
        "caseId": "CASE004",
        "name": "Emma Davis",
        "age": 22,
        "gender": "Female",
        "lastSeenLocation": "Shopping Mall",
        "status": "active",
        "description": "Missing since Feb 21",
        "thumbnailUrl": "/uploads/case4.jpg",
        "reidScore": 0.82,
        "attributeScore": 0.85,
        "gaitScore": 0.79,
        "fusionScore": 0.82
    },
    {
        "caseId": "CASE005",
        "name": "Robert Wilson",
        "age": 45,
        "gender": "Male",
        "lastSeenLocation": "Business District",
        "status": "active",
        "description": "Missing since Feb 19",
        "thumbnailUrl": "/uploads/case5.jpg",
        "reidScore": 0.75,
        "attributeScore": 0.80,
        "gaitScore": 0.83,
        "fusionScore": 0.79
    },
    {
        "caseId": "CASE006",
        "name": "Lisa Anderson",
        "age": 31,
        "gender": "Female",
        "lastSeenLocation": "Park Avenue",
        "status": "active",
        "description": "Missing since Feb 17",
        "thumbnailUrl": "/uploads/case6.jpg",
        "reidScore": 0.80,
        "attributeScore": 0.77,
        "gaitScore": 0.81,
        "fusionScore": 0.80
    },
    {
        "caseId": "CASE007",
        "name": "James Martinez",
        "age": 38,
        "gender": "Male",
        "lastSeenLocation": "University Campus",
        "status": "active",
        "description": "Missing since Feb 16",
        "thumbnailUrl": "/uploads/case7.jpg",
        "reidScore": 0.84,
        "attributeScore": 0.79,
        "gaitScore": 0.77,
        "fusionScore": 0.80
    },
    {
        "caseId": "CASE008",
        "name": "Rachel Taylor",
        "age": 27,
        "gender": "Female",
        "lastSeenLocation": "Airport Terminal",
        "status": "active",
        "description": "Missing since Feb 23",
        "thumbnailUrl": "/uploads/case8.jpg",
        "reidScore": 0.86,
        "attributeScore": 0.83,
        "gaitScore": 0.80,
        "fusionScore": 0.84
    }
]

result = db['missingpersons'].insert_many(sample_cases)
print(f"Inserted {len(result.inserted_ids)} missing person cases")
count = db['missingpersons'].count_documents({})
print(f"Total missing persons in DB: {count}")
