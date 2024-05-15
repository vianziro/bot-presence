const mysql = require("mysql2/promise");
const luxon = require("luxon");

/**
 * @type {mysql.Connection}
 */
let connection;
let active_connection = false;

let connect = async () => {
    try {
        connection = await mysql.createConnection({
            host: "localhost",
            user: "root",
            password: "",
            database: "presensi"
        });

        (await connection).connect().then(async () => {
            console.log("Connected with threadId " + (await connection).threadId)
            active_connection = true;
        }).catch(async () => {
            setTimeout(() => {
                console.log("Connection failed, reconnecting...");
                active_connection = false;
                connect();
            }, 1000);
        });
    } catch (err) {
        setTimeout(() => {
            console.log("Connection failed, reconnecting...");
            active_connection = false;
            connect();
        }, 1000);
    }
}

connect();

process.on("uncaughtException", (err) => {
    if (err.message.includes("is in closed state")) {
        setTimeout(() => {
            console.log("Connection lost, reconnecting...");
            active_connection = false;
            connect();
        }, 1000);
        return true;
    }
});

setInterval(async () => {
    if (typeof connection === "undefined") return;

    connection.ping().catch(() => {
        if (!active_connection) return;

        console.log("Connection lost, reconnecting");
        active_connection = false;
        connect();
    });
}, 2000)

function getRows(query) {
    let a = (async () => {
        let [rows, _] = (await (await connection).query(query));
        return rows;
    })().then((rows) => { return rows; });

}

class Setting {
    #instance_name;
    #radius_range;

    constructor() {
        return (async () => {
            let [rows, _] = (await (await connection).query("SELECT * FROM `setting` LIMIT 1;"));
            this.#instance_name = rows[0]["instance_name"];
            this.#radius_range = rows[0]["radius_range"];
            return this;
        })();
    }

    /**
     * @returns {String}
     */
    getInstanceName() {
        return this.#instance_name;
    }

    /**
     * @returns {Number}
     */
    getRadiusRange() {
        return this.#radius_range;
    }

    static async setInstanceName(name) {
        (await (await connection).query(`UPDATE setting SET instance_name = '${name}' WHERE id = 1;`));
    }

    static async setRadius(radius) {
        (await (await connection).query(`UPDATE setting SET radius_range = '${radius}' WHERE id = 1;`));
    }
}

class BaseCoordinates {
    /**
     * @type {[Number, Number][]}
     */
    #coords;

    constructor() {
        return (async () => {
            let [rows, _] = (await (await connection).query("SELECT * FROM `base_coordinates`;"));
            this.#coords = rows.map((v) => v["coordinates"].split(",").map((v) => parseFloat(v.trim())));
            this.#coords = this.#coords.map((v, i) => [...v, rows[i]["id"]])
            return this;
        })();
    }

    getList() {
        return this.#coords;
    }

    static async updateCoordinate(id, coordinate) {
        (await (await connection).query(`UPDATE base_coordinates SET coordinates = '${coordinate}' WHERE id = ${id};`));
    }

    static async createCoordinate(coordinate) {
        (await (await connection).query(`INSERT INTO base_coordinates VALUES (NULL, '${coordinate}');`));
    }

    static async deleteCoordinate(id) {
        (await (await connection).query(`DELETE FROM base_coordinates WHERE id = ${id};`));
    }
}

/**
 * @typedef DBShift
 * @prop {String} id
 */

/**
 * @typedef DBUser
 * @prop {String} id
 * @prop {String} name
 * @prop {String} phone_number
 * @prop {{shift_name: String, shift_id: String, time_in: {start: {hour: Number, minutes: Number}, end: {hour: Number, minutes: Number}}, time_out: {start: {hour: Number, minutes: Number}, end: {hour: Number, minutes: Number}}}} shift
 */

class Users {
    /**
     * @type {DBUser[]}
     */
    #users;

    constructor() {
        return (async () => {
            let [rows, _] = (await (await connection).query("SELECT * FROM `users`;"));
            let shifts = (await new ShiftType());
            this.#users = rows.map((v) => {
                return {
                    id: v["user_id"],
                    name: v["user_name"],
                    phone_number: v["phone_number"],
                    shift: shifts.getShift(v["shift_id"])
                }
            });
            return this;
        })();
    }

    getUsers() {
        return this.#users;
    }

    /**
     * @param {String} user_id 
     * @returns 
     */
    getUserByID(user_id) {
        return this.#users.find((v) => v.id === user_id);
    }

    async deleteUserByID(user_id) {
        (await (await connection).query("DELETE FROM `users` WHERE `user_id`='" + user_id + "';"));
    }

    static async createUser(data) {
        (await (await connection).query(`INSERT INTO users VALUES ('${data["user_id"]}','${data["user_name"]}','${data["phone"]}','${data["shift"]}')`));
    }

    /**
     * @param {String} phone_number 
     * @returns 
     */
    getUserByPhoneNumber(phone_number) {
        return this.#users.find((v) => v.phone_number === phone_number);
    }
}

class User {
    /**
     * @type {DBUser}
     */
    #user;

    constructor(user_id) {
        return (async () => {
            this.#user = (await new Users()).getUserByID(user_id);
            return this;
        })();
    }

    async setNoTelp(no_telp) {
        if (this.#user === undefined) return null;
        await (await connection).query(`UPDATE users SET phone_number='${no_telp}' WHERE user_id='${this.#user.id}';`);
    }

    async setUserName(username) {
        if (this.#user === undefined) return null;
        await (await connection).query(`UPDATE users SET user_name='${username}' WHERE user_id='${this.#user.id}';`);
    }

    async setShiftId(shift_id) {
        if (this.#user === undefined) return null;
        await (await connection).query(`UPDATE users SET shift_id='${shift_id}' WHERE user_id='${this.#user.id}';`);
    }

    async isAdmin() {
        if (this.#user === undefined) return null;
        let [ rows ] = await (await connection).query(`SELECT is_admin FROM users WHERE user_id='${this.#user.id}';`);
        
        return rows[0]["is_admin"];
    }
}

class ShiftType {
    /**
     * @type {Map<Number, {shift_name: String, shift_id: Number, time_in: {start: {hour: Number, minutes: Number}, end: {hour: Number, minutes: Number}}, time_out: {start: {hour: Number, minutes: Number}, end: {hour: Number, minutes: Number}}}>}
     */
    #shifts;

    constructor() {
        return (async () => {
            let [rows, _] = (await (await connection).query("SELECT * FROM `shift_type`;"));

            let map = new Map();
            for (let shift of rows) {
                let time_in_start = shift.time_in.split("-")[0].split(":");
                let time_in_end = shift.time_in.split("-")[1].split(":");

                let time_out_start = shift.time_out.split("-")[0].split(":");
                let time_out_end = shift.time_out.split("-")[1].split(":");

                map.set(shift.shift_id, { shift_name: shift.shift_name, shift_id: shift.shift_id, time_in: { start: { hour: parseInt(time_in_start[0]), minutes: parseInt(time_in_start[1]) }, end: { hour: parseInt(time_in_end[0]), minutes: parseInt(time_in_end[1]) } }, time_out: { start: { hour: parseInt(time_out_start[0]), minutes: parseInt(time_out_start[1]) }, end: { hour: parseInt(time_out_end[0]), minutes: parseInt(time_out_end[1]) } } });
            }
            this.#shifts = map;

            return this;
        })();
    }

    getShifts() {
        return this.#shifts;
    }

    /**
     * @param {Number} id 
     */
    getShift(id) {
        return this.#shifts.get(id);
    }

    static async createShift(data) {
        (await (await connection).query(`INSERT INTO shift_type VALUES (NULL, '${data["shift_name"]}','${data["time_in"]}','${data["time_out"]}')`));
    }
}

class Shift {
    /**
     * @type {DBUser}
     */
    #shift;

    constructor(shift_id) {
        return (async () => {
            this.#shift = (await new ShiftType()).getShift(parseInt(shift_id));
            return this;
        })();
    }

    async delete() {
        if (this.#shift === undefined) return null;
        (await (await connection).query("DELETE FROM `shift_type` WHERE `shift_id`='" + this.#shift.shift_id + "';"));
    }

    async setName(name) {
        if (this.#shift === undefined) return null;
        await (await connection).query(`UPDATE shift_type SET shift_name='${name}' WHERE shift_id=${this.#shift.shift_id};`);
    }

    async setTimeIn(time_in) {
        if (this.#shift === undefined) return null;
        await (await connection).query(`UPDATE shift_type SET time_in='${time_in}' WHERE shift_id=${this.#shift.shift_id};`);
    }

    async setTimeOut(time_out) {
        if (this.#shift === undefined) return null;
        await (await connection).query(`UPDATE shift_type SET time_out='${time_out}' WHERE shift_id=${this.#shift.shift_id};`);
    }
}

class Presence {
    #phone_number;

    constructor(phone_number) {
        this.#phone_number = phone_number;
    }

    static async createPresence(user_id, time, value) {
        await (await connection).query(`INSERT INTO presence VALUES (NULL, '${user_id}', '0.0,0.0', '2', '${time}', '', '${value}');`);
    }

    static async updatePresence(user_id, time, value) {
        await (await connection).query(`UPDATE presence SET type = '${value}' WHERE time_in = '${time}' AND user_id = '${user_id}'`);
    }

    static async getPresenceNow() {
        let [rows, _] = await (await connection).query(`SELECT * FROM presence WHERE DATE(time_in) = CURDATE();`);

        return await Promise.all(rows.map(async (v) => {
            let user = (await new Users()).getUserByID(v["user_id"]);

            return {
                id: v["presence_id"],
                user,
                coords: v["presence_coords"].replace(" ", ""),
                status: v["presence_status"],
                time_in: v["time_in"],
                time_out: v["time_out"],
                type: v["type"]
            }
        }));
    }

    static async getPresenceNowOf(user_id) {
        let [rows, _] = await (await connection).query(`SELECT * FROM presence WHERE DATE(time_in) = CURDATE() AND user_id='${user_id}';`);

        return await Promise.all(rows.map(async (v) => {
            let user = (await new Users()).getUserByID(v["user_id"]);

            return {
                id: v["presence_id"],
                user,
                coords: v["presence_coords"].replace(" ", ""),
                status: v["presence_status"],
                time_in: v["time_in"],
                time_out: v["time_out"],
                type: v["type"]
            }
        }));
    }

    static async getPresenceHistoryOf(user_id) {
        let [rows, _] = await (await connection).query(`SELECT * FROM presence WHERE user_id='${user_id}';`);

        return await Promise.all(rows.map(async (v) => {
            let user = (await new Users()).getUserByID(v["user_id"]);

            return {
                id: v["presence_id"],
                user,
                coords: v["presence_coords"].replace(" ", ""),
                status: v["presence_status"],
                time_in: v["time_in"],
                time_out: v["time_out"],
                type: v["type"]
            }
        }));
    }

    static async getPresenceHistory() {
        let [rows, _] = await (await connection).query(`SELECT * FROM presence;`);

        return await Promise.all(rows.map(async (v) => {
            let user = (await new Users()).getUserByID(v["user_id"]);

            return {
                id: v["presence_id"],
                user,
                coords: v["presence_coords"].replace(" ", ""),
                status: v["presence_status"],
                time_in: v["time_in"],
                time_out: v["time_out"],
                type: v["type"]
            }
        }));
    }

    // {id: Number, user: DBUser, coords: { lat: Number, long: Number }, status: Number, time_in: String, time_out: String}

    async getPresence() {
        let user = await this.getUser();
        if (user === undefined) return null;

        let [rows, _] = await (await connection).query(`SELECT * FROM presence WHERE DATE(time_in) = CURDATE() AND user_id = ${user.id} ORDER BY presence_id DESC LIMIT 1;`);

        if (rows.length < 1) return null;

        let coords = rows[0]["presence_coords"].split(",").map((v) => parseFloat(v.trim()));

        return {
            id: rows[0]["presence_id"],
            user,
            coords: {
                lat: coords[0],
                long: coords[1]
            },
            status: rows[0]["presence_status"],
            time_in: luxon.DateTime.fromSQL(rows[0]["time_in"]),
            time_out: luxon.DateTime.fromSQL(rows[0]["time_out"])
        };
    }

    async setPresence(state, coords) {
        let user = await this.getUser();
        if (user === undefined) return null;

        if (!await this.isExist()) {
            await (await connection).query(`INSERT INTO presence (user_id, presence_coords, time_in, time_out) VALUES ('${user.id}', '${coords}', NOW(), '');`);
            return true;
        };

        let presence = await this.getPresence();

        await (await connection).query(`UPDATE presence SET presence_coords = '${coords}', type = 1, presence_status = ${state}, ${(state == 0) ? "time_in = NOW()" : "time_out = NOW()"} WHERE presence_id = ${presence.id}`);

        return true;
    }

    async getUser() {
        return (await new Users()).getUserByPhoneNumber(this.#phone_number);
    }

    async isExist() {
        return await this.getPresence() !== null;
    }
}

module.exports = {
    Setting,
    BaseCoordinates,
    User,
    Users,
    Shift,
    ShiftType,
    Presence,
}
