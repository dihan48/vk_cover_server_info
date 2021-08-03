const fs = require('fs')
const http = require("http")
const https = require('https')
const FormData = require('form-data')
const Gamedig = require('gamedig')
const unirest = require('unirest')
const { registerFont, createCanvas, loadImage } = require('canvas')

const group = process.env.vk_group,
    token = process.env.vk_token,
    host = process.env.game_host,
    type = process.env.game_type,
    port = process.env.query_port
let logs = { date: "", server: "", img: "", upload: "", save: "" }

http.createServer(function(request, response){
    response.end(`date: ${logs.date}\nserver: ${logs.server}\nimg: ${logs.img}\nupload: ${logs.upload}\nsave: ${logs.save}`)
}).listen(3000)

function loop() {
    try{
        logs = { date: new Date().toLocaleString("ru", {timeZone: 'Europe/Moscow'}), server: "", img: "", upload: "", save: "" }
        const requestUploadUrl = () => `https://api.vk.com/method/photos.getOwnerCoverPhotoUploadServer?group_id=${group}&crop_x=0&crop_y=0&crop_x2=1590&crop_y2=400&v=5.50&access_token=${token}`
        const saveImageUrl = (data) => `https://api.vk.com/method/photos.saveOwnerCoverPhoto?hash=${data.hash}&photo=${data.photo}&v=5.50&access_token=${token}`

        // Gamedig.query({ type, host, port }).then((info) => {
        //     logs.server = "on"
        //     createImage(info)
        // }).catch((error) => {
        //     logs.server = "off"
        // })
        // toster lox

        unirest.get("https://api.battlemetrics.com/servers/2481126")
        .end(function (result) {
            let json = JSON.parse(JSON.stringify(result.body));
            logs.server = [json.data.attributes.players,json.data.attributes.maxPlayers];
            console.log(json);
            createImage(json.data.attributes)
        });

        function createImage(info) {
            registerFont('1.ttf', { family: 'customfont' })
            logs.img = "creating"
            loadImage('1.jpg').then((image) => {
                const canvas = createCanvas(image.width, image.height)
                const ctx = canvas.getContext('2d')
                
                ctx.drawImage(image, 0, 0, image.width, image.height)

                ctx.font = '38px customfont'
                ctx.fillStyle = 'rgb(51,48,48)'

                console.log(info.players,info.maxPlayers);

                const text = `${info.players}/${info.maxPlayers}`
                const box = ctx.measureText(text)
                const left=image.width/2-Math.round(box.width/2)
                const top=image.height/2-Math.round(box.emHeightAscent/2)

                ctx.fillText(text, left+480, top+56)
        
                const out = fs.createWriteStream('out.jpg')
                const stream = canvas.createJPEGStream()
                logs.img = "done"
                stream.pipe(out)
                out.on('finish', () => requestUpload())
            }).catch((error) => {
                logs.img = "error"
            })
        }

        function requestUpload() {
            logs.upload = "request url"
            const { host, pathname, search, protocol } = new URL(requestUploadUrl())
            const req = https.request(
                { host, protocol, path: pathname+search, method: 'GET' },
                res => res.on('data', parseUploadUrl)
            )
            req.end()
        }

        function parseUploadUrl(data){
            data = JSON.parse(data)
            if(data && data.response && data.response.upload_url){
                logs.upload = "in process"
                sendImage(data.response.upload_url)
            }else{
                logs.upload = "error"
            }
        }

        function sendImage(url) {
            const { hostname, pathname, search, protocol } = new URL(url)
            
            const form = new FormData()
            form.append('photo', fs.createReadStream('out.jpg'))
            
            const req = https.request(
                { hostname, protocol, path: pathname+search, method: 'POST', headers: form.getHeaders() },
                res => {
                    res.on('error', () => logs.upload="error")
                    res.on('data', saveImage)
                }
            )

            form.pipe(req)
        }

        function saveImage(data){
            logs.upload = "done"
            logs.save = "in process"
            const { host, pathname, search, protocol } = new URL(saveImageUrl(JSON.parse(data)))
            const req = https.request(
                { host, protocol, path: pathname+search, method: 'GET' },
                res => {
                    res.on('error', () => logs.save="error")
                    res.on('data', () => logs.save="done")
                }
            )
            req.end()
        }
    } catch(e) { }
}

loop()
setInterval(loop, 3*60*1000)