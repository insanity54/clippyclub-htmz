'use strict'

import 'dotenv/config'
import express from  'express'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import session from 'express-session'
import sqliteSessionStore from 'better-sqlite3-session-store'
import { dbPath } from './const.js'
import { z } from 'zod';


const SqliteStore = sqliteSessionStore(session)
const db = new Database(dbPath);
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express()
const port = process.env.PORT || 4000
const StatusEnum = z.enum(["pending", "LTMINCLIPS", "CHANNELNOTFOUND", "downloading", "rendering", "failed", "uploading", "complete"]);
const MethodEnum = z.enum(["popular", "random"]);
// Define schema for request parameters
const createCompilationSchema = z.object({
    channel: z.string().min(3).max(25),
    count: z.number().min(2).max(10),
    method: MethodEnum,
    range: z.number().min(1).max(365)
});

if (!process.env.EXPRESS_SESSION_SECRET) throw new Error('EXPRESS_SESSION_SECRET missing in env')

const sesh = {
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: false,
    cookie: {},
    store: new SqliteStore({
        client: db,
        expired: {
            clear: true,
            intervalMs: 900000
        }
    })
}
if (app.get('env') === 'production') {
    app.set('trust proxy', 1)
    sesh.cookie.secure = true
}


app.use(express.static(join(__dirname, '../public')))
app.use(session(sesh))

app.get('/api/create', (req, res) => {

    try {
        
        console.log(`a request was made and the sessionID is ${req.sessionID}`)

        const { channel, method } = req.query
        const count = parseInt(req.query.count)
        const range = parseInt(req.query.range)
        createCompilationSchema.parse({ channel, method, count, range })

        const insertStmt = db.prepare(`
            INSERT INTO compilations (channel, count, method, range, status, session)
            VALUES (@channel, @count, @method, @range, @status, @session)
        `);
        insertStmt.run({
            channel,
            count,
            method,
            range,
            status: 'pending',
            session: req.sessionID
        });

    
        res.redirect('/api/progress')
            
    } catch (error) {
        if (error instanceof z.ZodError) {
            let h = []
            h.push('<!DOCTYPE html>')
            h.push('<section id="primary">')
            h.push('<h4>Bad Request</h4>')
            h.push('<ul>')
            for (const e of JSON.parse(error.message)) {
                h.push('<li>')
                h.push(`<span>${e.path}-- ${e.message}</span>`)
                h.push('</li>')
            }
            h.push('</ul>')
            h.push('</section>')
            h.push('</html>')


            res.status(400).send(h.join('\n'));
        } else {
            res.status(500).send('<!DOCTYPE html><section id="primary">Internal Server Error</section></html>');
        }
    }


})

app.get('/api/progress', (req, res) => {

    
    const compilations = db.prepare('SELECT * FROM compilations WHERE session = ?').all(req.sessionID)

    // db
    // .prepare("UPDATE compilations SET status = @status WHERE id = @id")
    // .run({ id: job.id, status: 'downloading' });

    // console.log(compilations.length+' jobs as follows')
    // console.log(compilations)

    let jFormat = []
    jFormat.push('<!DOCTYPE html>')
    jFormat.push('<section id="primary">')
    jFormat.push('<h3>Compilations List</h3>')
    jFormat.push('<table>')
    jFormat.push('<tr>')
    jFormat.push(`<th>ID</th>`)
    jFormat.push(`<th>channel</th>`)
    jFormat.push(`<th>count</th>`)
    jFormat.push(`<th>method</th>`)
    jFormat.push(`<th>range</th>`)
    jFormat.push(`<th>status</th>`)
    jFormat.push(`<th>url</th>`)
    jFormat.push('</tr>')
    for (const j of compilations) {
        jFormat.push('<tr>')
        jFormat.push(`<td>${j?.id}</td>`)
        jFormat.push(`<td>${j?.channel}</td>`)
        jFormat.push(`<td>${j?.count}</td>`)
        jFormat.push(`<td>${j?.method}</td>`)
        jFormat.push(`<td>${j?.range}</td>`)
        jFormat.push(`<td>${j?.status}</td>`)
        jFormat.push(`<td>${j?.url || ''}</td>`)
        jFormat.push('</tr>')
    }
    jFormat.push('</table>')
    jFormat.push(`<a href="/api/progress#primary" target=htmz>refresh</a>`)
    jFormat.push('</section>')
    jFormat.push('</html>')

    res.send(jFormat.join('\n'))
})






app.listen(port, () => {
    console.log(`listening on port ${port}`)
})