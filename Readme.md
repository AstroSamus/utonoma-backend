Readme.md

Steps to run the backend:

1. Install the Postresql and start the server
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql


2. Create user 
CREATE USER myuser WITH PASSWORD 'mypassword';
CREATE DATABASE mydb OWNER myuser;
Exit with the next command: \q

3. Create the table in the db, schema.sql can be find in the root folder of the 
project
psql -h localhost -U myuser -d mydb -f schema.sql

4. Update your .env to reflect your user and password in postresql

5. Install the project with npm install

6. Install ffmpeg with sudo apt install ffmpeg or similar (depending on os). This is important as we call ffmpeg from node

6. run with npm run dev 
do not forget to run "sudo systemctl start postgresql" to start the postresql server


### Backend Container Diagram

```mermaid
C4Container
title Container Diagram - Backend API

System_Ext(frontend, "Frontend Web App", "Uploads content and subscribes to progress updates")
System_Ext(blockchain, "Blockchain Network", "Receives transactions / reads on-chain data")
System_Ext(storage, "Object Storage", "Stores uploaded media files")
System_Ext(ipfs, "IPFS provider", "Provides decentralized storage")


System_Boundary(backend, "Utonoma Backend") {
  Container(api, "REST API", "Node.js / Express", "Handles HTTP requests, upload sessions, wallets, and content metadata")

  Container(jobQueue, "Job Queue", "Redis", "Notifies pending work")

  Container(videoWorker, "Media Processing Worker", "Node.js / FFmpeg", "Processes uploaded media and updates processing status")

  Container(moderationWorker, "Moderation Worker", "Python", "Detects copyright infringments and explicit content")

  Container(uploadWorker, "Upload Worker", "Node.js", "Uploads content to IPFS")

  ContainerDb(db, "Database", "PostgreSQL", "Stores upload sessions, wallets, content metadata, and processing status")
}

Rel(api, db, "Reads and Writes")
Rel(jobQueue, db, "Polls pending work")
Rel(jobQueue, videoWorker, "Informs pending work")
Rel(jobQueue, moderationWorker, "Informs pending work")
Rel(jobQueue, uploadWorker, "Informs pending work")

Rel(videoWorker, storage, "reads and writes videos")
Rel(moderationWorker, storage, "reads videos")
Rel(uploadWorker, storage, "reads videos")

Rel(videoWorker, db, "informs cids")
Rel(moderationWorker, db, "informs cids")
Rel(uploadWorker, db, "informs cids")

Rel(uploadWorker, blockchain, "Listen events")
Rel(uploadWorker, ipfs, "uploads content")

Rel(frontend, api, "Uploads content", "HTTPS / JSON")
Rel(api, frontend, "Sends progress updates and IPFS CIDs", "Server-Sent Events")
```

### Entity - Relation diagram

```mermaid
erDiagram
    UPLOAD_SESSION {
        uuid id PK
        string creatorAddress FK
        date startedAt
        json contentUris
        string status
    }
```