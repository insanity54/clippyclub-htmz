import Database from 'better-sqlite3'
import { dataPath, dbPath } from "./const.js"
import { mkdir } from 'fs/promises'

async function main() {

    await mkdir(dataPath, { recursive: true })
    
    const db = new Database(dbPath, { verbose: console.log });
    db.pragma('journal_mode = WAL');

    // Define the table schema
    db.exec(`
        CREATE TABLE IF NOT EXISTS compilations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel TEXT,
            count INTEGER,
            method TEXT,
            range INTEGER,
            status TEXT,
            manifest TEXT,
            session TEXT
        );
    `);

    // Generate dummy data
    const dummyData = [
        { channel: 'ironmouse', count: 10, method: 'popular', range: 7, status: 'rendering' },
        { channel: 'henyathegenius', count: 20, method: 'random', range: 30, status: 'finished' },
        // Add more dummy data as needed
    ];

    // Insert dummy data into the database
    const insertStmt = db.prepare(`
        INSERT INTO compilations (channel, count, method, range, status)
        VALUES (@channel, @count, @method, @range, @status)
    `);
    db.transaction(() => {
        for (const data of dummyData) {
            insertStmt.run(data);
        }
    })();

    db.close();
}

main();
