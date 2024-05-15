const { Client, LocalAuth } = require("whatsapp-web.js");
const qrterminal = require("qrcode-terminal");
const config = require("./config.js");
const db = require("./database.js");
const { MessageTypes } = require("whatsapp-web.js/src/util/Constants.js");
const WAWebJS = require("whatsapp-web.js");
const { DateTime } = require("luxon");
const geoDistance = require("geo-dist");

let client = new Client({
    authStrategy: new LocalAuth()
});

class UserState {
    /**
     * @typedef {("INPUT_ID" | "CHECK_IN" | "CHECK_OUT")} State
     */

    /**
     * @type {{number: String, state: State}[]}
     */
    static state = [];

    /**
     * @param {String} number 
     * @param {State} state 
     * @param {WAWebJS.Message} message
     */
    static set(number, state, message) {
        this.state.push( {number: number, state: state} );

        let timeout = setTimeout(async () => {
            sendMessage("Masa request telah habis", message);
            this.remove(number);
            clearTimeout(timeout);
            clearInterval(interval);
        }, 60000)
        
        let interval = setInterval(() => {
            if (!this.has(number)) {
                clearTimeout(timeout);
                clearInterval(interval);
            }
        }, 100);
    }

    /**
     * @param {String} number 
     */
    static get(number) {
        return this.state.find((v) => v.number === number);
    }

    /**
     * @param {String} number 
     */
    static has(number) {
        return typeof this.get(number) !== "undefined";
    }

    /**
     * @param {String} number 
     */
    static remove(number) {
        this.state = this.state.filter((v) => { return v.number !== number; });
    }
}

client.on("qr", (qr) => {
    qrterminal.generate(qr, { small: true });
});

client.on("ready", async () => {
    client.getState().then((state) => { console.log(state) })
    console.log((await new config()).lang.bot_ready);
});

client.on("message", async (message) => {
    if ((await message.getChat()).isGroup) return;
    (await message.getChat()).sendSeen();

    let conf = await new config();

    let userNumber = (await message.getChat()).id.user;
    let databaseInstance = new db.Presence(userNumber);
    let currentTime = DateTime.now().setZone(conf.botSetting.timezone);

    let returnStatus = async () => {
        let userRaw = (await new db.Users()).getUserByPhoneNumber(userNumber);

        if (typeof userRaw === "undefined") {
            await sendMessage("Terjadi kesalahan", message);
            return;
        }

        if (!await databaseInstance.isExist()) {
            await sendMessage(conf.getMessage({ userNumber, userName: userRaw.name, shiftName: userRaw.shift.shift_name, currentTime }).presence_empty, message);
        } else {
            let presence = await databaseInstance.getPresence();
    
            if (presence.status == 0) {
                let checkin = presence.time_in;
                
                let mg = conf.getMessage({ checkin: checkin, userNumber, currentTime, userName: userRaw.name, shiftName: userRaw.shift.shift_name }).presence_check_in;
    
                await sendMessage(mg , message);
            } else {
                let checkin = presence.time_in;
                let checkout = presence.time_out;
    
                await sendMessage(conf.getMessage({ checkin, checkout, userNumber, currentTime, userName: userRaw.name, shiftName: userRaw.shift.shift_name }).presence_check_in_out, message);
            }
        }
    };

    if (await databaseInstance.getUser() === undefined && !UserState.has(userNumber)) {
        await sendMessage(conf.getMessage({ currentTime }).id_not_found, message);
        UserState.set(userNumber, "INPUT_ID", message);
        return;
    }

    if (message.type === MessageTypes.LOCATION) {
        if (message.rawData["isLive"] !== true) {
            await sendMessage(conf.getMessage({ currentTime, userNumber }).must_live_location, message);
            return;
        }

        if (message.isForwarded) {
            console.log(`User ${userNumber} mencoba forward lokasi!`);
            await sendMessage(conf.getMessage({ currentTime, userNumber }).forward_forbidden, message);
            return;
        }

        let location = message.location;

        if (UserState.has(userNumber)) {
            let state = UserState.get(userNumber);

            let coords = (await new db.BaseCoordinates()).getList();
            let distances = [];

            for (let coord of coords) {
                let distance = geoDistance(
                    parseFloat(coord[0]),
                    parseFloat(coord[1]),
                    parseFloat(location.latitude),
                    parseFloat(location.longitude),
                ) * 1000;

                distances.push(distance);
            }

            if (["CHECK_IN", "CHECK_OUT"].includes(state.state)) {
                let sett = await new db.Setting();
                if (distances.map((v) => v > sett.getRadiusRange()).includes(true)) {
                    await sendMessage(conf.getMessage({ currentTime, userNumber }).radius_too_far, message);
                    return;
                }
            }
    
            if (state.state === "CHECK_IN") {
                let koordinat = `${location.latitude},${location.longitude}`;

                await databaseInstance.setPresence(0, koordinat);

                await returnStatus();
    
                UserState.remove(userNumber);
                return;
            }

            if (state.state === "CHECK_OUT") {
                let koordinat = `${location.latitude},${location.longitude}`;

                await databaseInstance.setPresence(1, koordinat);

                await returnStatus();
                UserState.remove(userNumber);
                return;
            }
        }
    }

    if (message.type === MessageTypes.TEXT) {
        let args = message.body.toLowerCase().split(" ").map((v) => v.trim());

        if (UserState.has(userNumber)) {
            let state = UserState.get(userNumber);

            if (state.state === "INPUT_ID") {
                let id = args[0];
                let userRaw = (await new db.Users()).getUserByID(id);

                if (typeof userRaw === "undefined") {
                    await sendMessage(conf.getMessage({ currentTime, userNumber }).id_cannot_search, message);
                    return;
                }

                let user = await new db.User(userRaw.id);

                if (typeof userRaw.phone_number === "string") {
                    if (userRaw.phone_number.length > 2) {
                        await sendMessage(conf.getMessage({ currentTime, userNumber }).id_already_defined, message);
                        return;
                    }
                }

                user.setNoTelp(userNumber);

                await sendMessage(conf.getMessage({ currentTime, userNumber, shiftName: userRaw.shift.shift_name, userName: userRaw.name }).success_define_number, message);
                UserState.remove(userNumber);
                return;
            }

            return;
        }

        let command = args.shift();

        if (command === "check" || command === "chk") {
            let type = args.shift();

            if (typeof type === "undefined") {
                await sendMessage(conf.getMessage({ currentTime, userNumber }).command_usage, message);
                return;
            }

            if (type === "in") {
                let time = (await new db.Users()).getUserByPhoneNumber(userNumber).shift.time_in;

                let start = currentTime.set({ hour: time.start.hour, minute: time.start.minutes });
                let end = currentTime.set({ hour: time.end.hour, minute: time.end.minutes });

                if (await databaseInstance.isExist()) {
                    await sendMessage(conf.getMessage({ currentTime, userNumber }).already_check_in, message);
                    return;
                }
                
                if (currentTime.toMillis() < start.toMillis()) {
                    await sendMessage(conf.getMessage({ currentTime, userNumber, checkin: start }).not_checkin_time_before, message);
                    return;
                }

                if (currentTime.toMillis() > end.toMillis()) {
                    await sendMessage(conf.getMessage({ currentTime, userNumber, checkin: end }).not_checkin_time_after, message);
                    return;
                }

                await sendMessage(conf.getMessage({ currentTime, userNumber }).send_location, message);

                UserState.set(userNumber, "CHECK_IN", message);
                return;
            }

            if (type === "out") {
                let time = (await new db.Users()).getUserByPhoneNumber(userNumber).shift.time_out;

                let start = currentTime.set({ hour: time.start.hour, minute: time.start.minutes });
                let end = currentTime.set({ hour: time.end.hour, minute: time.end.minutes });

                if (!await databaseInstance.isExist()) {
                    await sendMessage(conf.getMessage({ currentTime, userNumber, checkin: start }).not_yet_checkin, message);
                    return;
                }

                if ((await databaseInstance.getPresence()).status == 1) {
                    await sendMessage(conf.getMessage({ currentTime, userNumber }).already_check_out, message);
                    return;
                }
                
                if (currentTime.toMillis() < start.toMillis()) {
                    await sendMessage(conf.getMessage({ currentTime, userNumber, checkout: end }).not_checkout_time_before, message);
                    return;
                }

                if (currentTime.toMillis() > end.toMillis()) {
                    await sendMessage(conf.getMessage({ currentTime, userNumber, checkout: end }).not_checkout_time_after, message);
                    return;
                }

                await sendMessage(conf.getMessage({ currentTime, userNumber }).send_location, message);

                UserState.set(userNumber, "CHECK_OUT", message);
                return;
            }

            return;
        }
    }
    
    await returnStatus();
    await sendMessage(conf.getMessage({ currentTime, userNumber }).command_usage, message);
});

async function sendMessage(message, chat) {
    let setting = await new db.Setting();
    let conf = await new config();
    
    (await chat.getChat()).sendMessage(conf.getMessage({ instance_name: setting.getInstanceName(), message }).message_template);
}

async function sendNewMessage(message, number) {
    client.sendMessage(`${number}@c.us`, message);
}

module.exports = {
    start: () => { client.initialize() },
    stop: () => { client.destroy() },
    isRunning: () => { return (client.getChats().then(() => { return true; }).catch(() => { return false })) },
    db,
    sendNewMessage
}