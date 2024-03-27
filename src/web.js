'use strict'

import 'dotenv/config'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Fastify from 'fastify'
import oauthPlugin from '@fastify/oauth2'
import views from '@fastify/view'
import handlebars from 'handlebars'
import fastifyStatic from '@fastify/static'
import fastifyAuth from '@fastify/auth'
import fastifySession from '@fastify/secure-session'
import fastifyBetterSqlite3 from '@punkish/fastify-better-sqlite3'
import fastifyFlash from '@fastify/flash'
import { initDb } from './db.js'
import yup from 'yup'
import { readFileSync } from 'fs' 

// use different env file when running with vault sidecar
// greetz https://tansanrao.com/hashicorp-vault-sidecar/
// let secretsFile = '/vault/secrets/env'
// try {
//     console.log(`attempting to use secrets from ${secretsFile}`)
//     dotenv.config({ path: secretsFile })
// } catch (e) {
//     console.error(e)
//     console.log('attempting to use default .env')
//     dotenv.config()
// }

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 4000
// with yup option strict = false, yup `validateSync` function returns the
// coerced value if validation was successful, or throws if validation failed
const yupOptions = {
    strict: false,
    abortEarly: false, // return all errors
    stripUnknown: true, // remove additional properties
    recursive: true
}
// const StatusEnum = z.enum(["pending", "LTMINCLIPS", "CHANNELNOTFOUND", "downloading", "rendering", "failed", "uploading", "complete"]);
// const MethodEnum = z.enum(["popular", "random"]);
// Define schema for request parameters
// const createCompilationSchema = z.object({
//     channel: z.string().min(3).max(25),
//     count: z.number().min(2).max(10),
//     method: MethodEnum,
//     range: z.number().min(1).max(365)
// });



if (!process.env.EXPRESS_SESSION_SECRET) throw new Error('EXPRESS_SESSION_SECRET missing in env')
// console.log(`process.env.EXPRESS_SESSION_SECRET=${process.env.EXPRESS_SESSION_SECRET}`)
if (!process.env.TWITCH_CLIENT_ID) throw new Error('TWITCH_CLIENT_ID missing in env')
if (!process.env.TWITCH_CLIENT_SECRET) throw new Error('TWITCH_CLIENT_SECRET missing in env')
if (!process.env.GUMROAD_CLIENT_ID) throw new Error('GUMROAD_CLIENT_ID missing in env')
if (!process.env.GUMROAD_CLIENT_SECRET) throw new Error('GUMROAD_CLIENT_SECRET missing in env')
if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET undefined in env')
if (!process.env.SITE_URL) throw new Error('SITE_URL undefined in env')

async function buildFastify(opts) {
    const fastify = Fastify(opts)
    const db = await initDb()
    const dbOpts = {
        'class': db.class,
        'connection': db.connection
    }

    fastify.register(fastifyAuth)

    fastify.register(fastifySession, {
        sessionName: 'session',
        key: process.env.SESSION_SECRET,
        cookie: {
            path: '/'
        }
    })

    fastify.register(fastifyFlash)

    fastify.register(fastifyBetterSqlite3, dbOpts)
    fastify.register(fastifyStatic, {
        root: join(__dirname, '../public'),
        prefix: '/',
    })
    fastify.register(views, {
        engine: {
            handlebars
        },
        root: join(__dirname, 'views'),
        defaultContext: {
            siteTitle: 'Clipstr.Club'
        },
        options: {
            partials: {
                head: 'head.hbs',
                logo: 'logo.hbs',
                scripts: 'scripts.hbs',
                sitemap: 'sitemap.hbs',
            }
        }
    })

    fastify.register(oauthPlugin, {
        name: 'twitchOauth2',
        credentials: {
            client: {
                id: process.env.TWITCH_CLIENT_ID,
                secret: process.env.TWITCH_CLIENT_SECRET
            }
        },
        tokenRequestParams: {
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
        },
        // register a fastify url to start the redirect flow
        startRedirectPath: '/login/twitch',
        // twitch redirect here after the user login
        callbackUri: process.env.SITE_URL+'/login/twitch/callback',
        // scope: 'user:read:email', // I DO NOT want user e-mails!
        scope: '',
        discovery: {
            issuer: 'https://id.twitch.tv/oauth2'
        }
    })

    fastify.register(oauthPlugin, {
        name: 'gumroadOauth2',
        credentials: {
            client: {
                id: process.env.GUMROAD_CLIENT_ID,
                secret: process.env.GUMROAD_CLIENT_SECRET
            },
            auth: {
                authorizeHost: 'https://gumroad.com',
                authorizePath: '/oauth/authorize',
                tokenHost: 'https://api.gumroad.com',
                tokenPath: '/oauth/token'
            }
        },
        tokenRequestParams: {
            client_id: process.env.GUMROAD_CLIENT_ID,
            client_secret: process.env.GUMROAD_CLIENT_SECRET
        },
        startRedirectPath: '/login/gumroad',
        callbackUri: process.env.SITE_URL+'/login/gumroad/callback',
        scope: 'view_profile'
    })

    fastify.after(routes)
    fastify.decorate('verifyMember', verifyMember)
    fastify.decorate('verifyLogin', verifyLogin)
    fastify.decorate('verifyUserAndPassword', verifyUserAndPassword)


    /**
     * done() if user is logged in.
     * done(new Error()) otherwise.
     */
    function verifyLogin(req, res, done) {
        // user is considered logged in if
        //   * session.twitchAuth present
        //   * session.twitchAuth not expired

        console.log('verifyLogin')
        console.log(req.session)
        console.log('the following is gumroadAuth')

        
        
        const gumroadAuth = req.session.get('gumroadAuth')
        console.log(gumroadAuth)
        if (!gumroadAuth) return done(new Error('gumroadAuth is missing'));

        // fyi, gumroad does not expire their access tokens automatically

        done()

    }


    /**
     * done() is called only if the user is a member
     * otherwise, done(new Error())
     */
    function verifyMember(req, res, done) {

        const db = fastify.betterSqlite3


        if (req.body && req.body.failureWithReply) {
            res.code(401).send({ error: 'Unauthorized' })
            return done(new Error())
        }

        console.log(`headers.auth=${req?.raw?.headers?.auth}`)


        if (!req.raw.headers.auth) {
            return done(new Error('Missing token header'))
        }

        jwt.verify(req.raw.headers.auth, onVerify)

        function onVerify(err, decoded) {
            if (err || !decoded.user || !decoded.password) {
                return done(new Error('Token not valid'))
            }

            console.log('here is the decoded user')
            console.log(decoded.user)

            //   level.get(decoded.user, onUser)
            try {
                db.prepare('SELECT * FROM users WHERE id = ?').findOne()
                const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.user.twitchId)
            } catch (e) {
                if (err.notFound) {
                    return done(new Error('Token not valid'))
                }
                if (!password || password !== decoded.password) {
                    return done(new Error('Token not valid'))
                }
            }

            done()

        }
    }

    function verifyUserAndPassword(request, res, done) {
        const level = this.level.authdb

        if (!request.body || !request.body.user) {
            return done(new Error('Missing user in request body'))
        }

        level.get(request.body.user, onUser)

        function onUser(err, password) {
            if (err) {
                if (err.notFound) {
                    return done(new Error('Password not valid'))
                }
                return done(err)
            }

            if (!password || password !== request.body.password) {
                return done(new Error('Password not valid'))
            }

            done()
        }
    }


    function routes() {
        /** GET / */
        fastify.route({
            method: 'GET',
            url: '/',
            handler: (req, res) => {
                return res.view('index')
            }
        })

        
        fastify.route({
            method: 'POST',
            url: '/api/ping',
            handler: (req, res) => {
                console.log(`POST /api/ping !!!`)
                console.log(req.body)
                res.send('OK')
            }
        })


        /** 
         * GET /api/create 
         * 
         * Yes, it's a little strange to use a GET request here instead of a POST request.
         * This is used in order to work with htmz
         */
        fastify.route({
            method: 'GET',
            url: '/api/create',
            schema: {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "type": "object",
                "properties": {
                    "channel": {
                        "type": "string"
                    },
                    "count": {
                        "type": "integer",
                        "minimum": 2,
                        "maximum": 10
                    },
                    "method": {
                        "type": "string",
                        "enum": ["popular", "latest", "trending"]
                    },
                    "range": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 365
                    }
                },
                "required": ["channel", "count", "method", "range"],
                "additionalProperties": false
            },
            // schema: yup.object().shape({
            //     channel: yup.string().required(),
            //     count: yup.number().integer().min(1).max(10).required(),
            //     method: yup.string().oneOf(['popular', 'random']).required(),
            //     range: yup.number().integer().min(1).max(365).required()
            // }),
            // validatorCompiler: ({ schema, method, url, httpPart }) => {
            //     return function (data) {
            //         try {
            //             console.log(`>>>> we are validating the following data`)
            //             console.log(data)
            //             const result = schema.validateSync(data, yupOptions)
            //             return { value: result }
            //         } catch (e) {
            //             return { error: e }
            //         }
            //     }
            // },
            preHandler: fastify.auth([
                fastify.verifyLogin
            ]),
            handler: (req, res) => {



                console.log(`handling! count=${req.query.count}`)
                console.log('the following is req.validationError')
                console.log(req.validationError)

                console.log('the following is validateInput')
                console.log(req.validateInput)
                console.log(req.query.count)

                const twitchUser = req.session.get('twitchUser')
                console.log(`twitchUser=${twitchUser}`)

                const {
                    channel,
                    count,
                    method,
                    range
                } = req.query

                const insertStmt = fastify.betterSqlite3.prepare(`
                    INSERT INTO compilations (channel, count, method, range, status, userId)
                    VALUES (@channel, @count, @method, @range, @status, @userId)
                `);

                insertStmt.run({
                    channel,
                    count,
                    method,
                    range,
                    status: 'pending',
                    userId: twitchUser.sub
                });

                res.redirect('/list')


            },
            errorHandler: (error, req, res) => {
                const warnings = res.flash('warnings', [error])
                console.log('there was an error while attempting to create')
                console.log(error)
                console.log(warnings)
                return res.view('create', { warnings })
            }
        })

        /** GET /create */
        fastify.route({
            method: 'GET',
            url: '/create',
            // @todo enable once lemonsqueezy payment system allows me on their platform
            // preHandler: fastify.auth([
            //     fastify.verifyMember
            // ]),
            handler: (req, res) => res.view('create'),
            errorHandler: (error, req, res) => {
                return res.redirect(302, '/account')
            }
        })

        /** GET /login */
        fastify.route({
            method: 'GET',
            url: '/login',
            handler: (req, res) => {
                const warnings = res.flash('warnings')
                res.view('login', { warnings })
            }
        })


        fastify.get('/about', (req, res) => {
            req.session.set('taco', 'i sure love  me a good meal')
            req.session.set('smoothie', 'slurp it up')
            res.view('about')
        })

        // example usage of secure session data retrieval
        // fastify.get('/aboot', (req, res) => {
        //     const taco = req.session.get('taco')
        //     const smoothie = req.session.get('smoothie')
        //     console.log(taco)
        //     console.log(smoothie)
        //     res.send(`OK dude. taco=${taco}, smoothie=${smoothie}`)
        // })

        /** GET /account */
        fastify.route({
            method: 'GET',
            url: '/account',
            preHandler: fastify.auth([
                fastify.verifyLogin
            ]),
            handler: (req, res) => {
                req.log.info('Auth route HIT! 1111111111')
                const twitchUser = req.session.get('twitchUser')
                const gumroadUser = req.session.get('gumroadUser')
                res.view('account', { 
                    username: twitchUser?.preferred_username, 
                    isMember: false,
                    accounts: [
                        {
                            name: 'Twitch',
                            loginUrl: '/login/twitch',
                            isLinked: !!twitchUser
                        },
                        {
                            name: 'Gumroad',
                            loginUrl: '/login/gumroad',
                            isLinked: !!gumroadUser
                        }
                    ]
                })
            },
            errorHandler: (error, req, res) => {
                console.error('errorHandler caught an error ' + error)
                return res.redirect(302, '/login')
            }
        })


        fastify.get('/cookies', (req, res) => {
            res.view('cookies')
        })

        /** GET /privacy */
        fastify.route({
            method: 'GET',
            url: '/privacy',
            handler: (req, res) => res.view('privacy')
        })




        fastify.get('/help', (req, res) => {
            res.view('help')
        })


        fastify.get('/sessionId', (req, res) => {
            const { sessionId } = req.query
            if (sessionId) {
                // user is restoring a sessionId


            }
            const id = req.sessionID
            res.send(`<!DOCTYPE html><pre><code>${id}</code></pre></html>`)
        })

        fastify.get("/login/gumroad/callback", async function (req, res) {
            console.log('gumroad oauth callback')
            const db = fastify.betterSqlite3
            const { token } = await this.gumroadOauth2.getAccessTokenFromAuthorizationCodeFlow(req)
            console.log(token.access_token)

            const userRes = await fetch(`https://api.gumroad.com/v2/user?access_token=${token.access_token}`)
            const data = await userRes.json()
            
            console.log('the following is user data')
            console.log(data)

            if (!data?.user?.id) throw new Error(`data from gumroad did not contain user id`);
            const gumroadId = data.user.id

            req.session.set('gumroadAuth', token)
            req.session.set('gumroadUser', data.user.id)

            const insertStmt = db.prepare(`
                INSERT OR IGNORE INTO users (gumroadId)
                VALUES (@gumroadId)
            `);

            insertStmt.run({
                'gumroadId': gumroadId
            });

            res.redirect("/account");


        })

        fastify.get("/login/twitch/callback", async function (req, res) {
            console.log('this.twitchOauth2 is as follows')
            console.log(this.twitchOauth2)
            const db = fastify.betterSqlite3

            const { token } = await this.twitchOauth2.getAccessTokenFromAuthorizationCodeFlow(req)
            console.log(token.access_token)

            console.log('the following is userinfo')
            const info = await this.twitchOauth2.userinfo(token)
            console.log(info)
            // console.log(this.twitchOauth2.userinfo())

            console.log('the following is the token')
            console.log(token)

            console.log('the following is the session')
            console.log(req.session)

            // set auth cookie
            // this gets encrypted and saved in the user's browser
            // so on subsequent visits, they don't have to log in again
            req.session.set('twitchAuth', token)
            req.session.set('twitchUser', info)

            // we need to save the user's twitch ID number
            // to our database, so when they later make compilations, we can match the compilation to the user
            const twitchId = info.sub
            console.log(`twitchId=${twitchId}`)


            const insertStmt = db.prepare(`
                INSERT OR IGNORE INTO users (twitchId)
                VALUES (@twitchId)
            `);

            insertStmt.run({
                'twitchId': twitchId
            });

            res.redirect("/account");
        });


        fastify.get('/logout', (req, res) => {
            req.session.set('twitchUser', null)
            req.session.set('twitchAuth', null)
            res.redirect('/')
        })

        fastify.get('/list', (req, res) => {
            const db = fastify.betterSqlite3
            const twitchUser = req.session.get('twitchUser')
            if (!twitchUser) {
                req.session.set('page', '/list')
                res.redirect('/login')
            }

            console.log(`following is twitchUser`)
            console.log(twitchUser)

            const { id: userId } = db.prepare('SELECT id FROM users WHERE twitchId = ?').get(twitchUser.sub)
            console.log(`here we get userId=${userId}`)


            console.log(`userId=${userId}`)
            if (!userId) {
                req.flash('warnings', ['user not found in database'])
                res.redirect('/login')
            }

            console.log('here we get compilations')
            const compilations = db.prepare('SELECT * FROM compilations WHERE userId = ?').all(userId)

            console.log(compilations)
            res.view('list', {
                compilations
            })
            // db
            // .prepare("UPDATE compilations SET status = @status WHERE id = @id")
            // .run({ id: job.id, status: 'downloading' });

            // console.log(compilations.length+' jobs as follows')
            // console.log(compilations)

            // let jFormat = []
            // jFormat.push('<!DOCTYPE html>')
            // jFormat.push('<section id="main">')
            // jFormat.push('<h3>Compilations List</h3>')
            // jFormat.push('<table>')
            // jFormat.push('<tr>')
            // jFormat.push(`<th>ID</th>`)
            // jFormat.push(`<th>channel</th>`)
            // jFormat.push(`<th>count</th>`)
            // jFormat.push(`<th>method</th>`)
            // jFormat.push(`<th>range</th>`)
            // jFormat.push(`<th>status</th>`)
            // jFormat.push(`<th>url</th>`)
            // jFormat.push('</tr>')
            // for (const j of compilations) {
            //     jFormat.push('<tr>')
            //     jFormat.push(`<td>${j?.id}</td>`)
            //     jFormat.push(`<td>${j?.channel}</td>`)
            //     jFormat.push(`<td>${j?.count}</td>`)
            //     jFormat.push(`<td>${j?.method}</td>`)
            //     jFormat.push(`<td>${j?.range}</td>`)
            //     jFormat.push(`<td>${j?.status}</td>`)
            //     jFormat.push(`<td>${j?.url || ''}</td>`)
            //     jFormat.push('</tr>')
            // }
            // jFormat.push('</table>')
            // jFormat.push(`<a href="/progress#main" target=htmz>refresh</a>`)
            // jFormat.push('</section>')
            // jFormat.push('</html>')

            // res.send(jFormat.join('\n'))
        })


    }
    return fastify
}



const server = (await buildFastify({ logger: true }))
server.listen({ port })