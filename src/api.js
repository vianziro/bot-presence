const bot = require("./bot");
const express = require("express");
const sha = require("js-sha256");
const { TOTP, Secret } = require("otpauth");

const app = express();

// TODO: Implement location list API
// TODO: Add some security, maybe...

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Methods", "*")
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
});

let startRequest = false;

let session = new Map();

function generateOTP(number) {
    let totp = new TOTP({
        secret: Secret.fromUTF8(sha.sha256(Buffer.from(number, "utf8").toString("base64")))
    });

    let token = totp.generate();

    return token;
}

app.patch("/auth", async (req, res) => {
    let buffer = [];

    req.on("data", (chunk) => {
        buffer.push(chunk);
    });

    req.on("end", async () => {
        let data = buffer.toString();

        let raw = (await new bot.db.Users()).getUserByPhoneNumber(data);
        let user = await new bot.db.User(raw.id);

        if (!await user.isAdmin()) {
            return res.send("ok");
        }

        let otp = generateOTP(data, toString()).toString();

        console.log(otp);

        bot.sendNewMessage(otp, data);

        // console.log(waitingAuth);

        res.send("success");
    });
});

app.get("/logout/:token", async (req, res) => {
    let token = req.params["token"] || "";

    if (token.length <= 0) {
        return res.send("ok");
    }

    console.log(session);

    session.forEach((v, k) => {
        if (v == token) {
            session.delete(k);
        }
    });

    console.log(session);

    return res.send("ok");
});

app.post("/auth", async (req, res) => {
    let buffer = [];

    req.on("data", (chunk) => {
        buffer.push(chunk);
    });

    req.on("end", async () => {
        let data = buffer.toString().split("|");

        let otp = generateOTP(data[0]);

        if (data[1] === otp) {
            let token = sha.sha256(otp);
            session.set(data[0], token);
            new Promise(() => {
                setTimeout(() => {
                    session.delete(data[0]);
                }, 1296000000);
            });
            return res.send(token);
        }

        console.log(otp);

        res.send("nop");
    });
});

app.get("/report/libur", async (req, res) => {
    let users = await new bot.db.Users();

    for (let u of users.getUsers()) {
        // let user = await new bot.db.User(u.id);
        let presence = await bot.db.Presence.getPresenceNowOf(u.id);
        let date = new Date();
        let now = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${(date.getDate()).toString().padStart(2, "0")} 00:00:00`;
        
        if (presence.length > 0) {
            await bot.db.Presence.updatePresence(u.id, now, "4");
        } else {
            await bot.db.Presence.createPresence(u.id, now, "4");
        }
    }

    res.send("Success");
});

app.post("/report/set/:id", async (req, res) => {
    let id = req.params["id"] || "";

    if (id.length <= 0) {
        return res.send("invalid id");
    }

    let buffer = [];

    req.on("data", (chunk) => {
        buffer.push(chunk);
    });

    req.on("end", async () => {
        let data = buffer.toString();

        if (!data) return res.send("Failed");

        data = data.split("|");

        if (data.length < 3) return res.send("Failed");

        if (data[2] == "CREATE") {
            await bot.db.Presence.createPresence(id, data[0], data[1]);
        }

        if (data[2] == "UPDATE") {
            await bot.db.Presence.updatePresence(id, data[0], data[1]);
        }


        res.send("Success");
    });
});

app.get("/report/total/now", async (req, res) => {
    let histories = await bot.db.Presence.getPresenceNow();
    let amount = 0;

    for (let history of histories) {
        if (history.type > 0) {
            amount += 1;
        }
    }

    res.setHeader("content-type", "application/json");
    res.send(amount.toString());
});

app.get("/report/now/:id", async (req, res) => {
    let id = req.params["id"] || "";

    if (id.length <= 0) {
        return res.send("invalid id");
    }

    let histories = await bot.db.Presence.getPresenceNowOf(id);

    let amount = 0;

    for (let history of histories) {
        if (history.status < 2) {
            amount += 1;
        }
    }

    res.setHeader("content-type", "application/json");
    res.send(amount.toString());
});

app.get("/report/presence/:id", async (req, res) => {
    let id = req.params["id"] || "";

    if (id.length <= 0) {
        return res.send("invalid id");
    }

    let histories = await bot.db.Presence.getPresenceHistoryOf(id);

    res.setHeader("content-type", "application/json");
    res.send(JSON.stringify(histories));
});

app.get("/total/presence", async (req, res) => {
    let histories = await bot.db.Presence.getPresenceHistory();
    let amount = 0;

    for (let history of histories) {
        if (history["time_out"]) {
            amount += 1;
        }
        amount += 1;
    }

    res.send(amount.toString());
})

app.get("/presence/history", async (req, res) => {
    let histories = await bot.db.Presence.getPresenceHistory();

    let page = parseInt(req.query["page"]) || 0;

    let result_splitted = [];

    for (let history of histories) {
        if (history["time_out"]) {
            result_splitted.push({
                id: history["id"],
                user: history["user"],
                coords: history["coords"],
                status: history["status"],
                time_out: history["time_out"],
                type: history["type"]
            });
        }
        result_splitted.push({
            id: history["id"],
            user: history["user"],
            coords: history["coords"],
            status: history["status"],
            time_in: history["time_in"],
            type: history["type"]
        });
    }

    let num = parseInt(req.query["num"]) || result_splitted.length;

    let result = result_splitted.slice((num * page), ((num * page) + num));

    res.setHeader("content-type", "application/json");
    res.send(JSON.stringify(result));
});

app.post("/settings/:option", async (req, res) => {
    let option = req.params["option"] || "";
    let value = req.query["value"] || "";

    if (option.length <= 0) {
        return res.send("invalid option");
    }

    if (value.length <= 0) {
        return res.send("invalid value");
    }

    if (option === "instance") {
        bot.db.Setting.setInstanceName(value);
        return res.send("success");
    }

    if (option === "radius") {
        bot.db.Setting.setRadius(value);
        return res.send("success");
    }

    res.send("failed");
});

app.get("/settings/:option", async (req, res) => {
    let option = req.params["option"] || "";

    if (option.length <= 0) {
        return res.send("invalid option");
    }

    let setting = await new bot.db.Setting();

    if (option === "instance") {
        return res.send(setting.getInstanceName());
    }

    if (option === "radius") {
        return res.send(setting.getRadiusRange().toString());
    }

    res.send("failed");
});

app.delete("/coordinates/:id", async (req, res) => {
    let id = req.params["id"] || "";

    if (id.length <= 0) {
        return res.send("invalid id");
    }

    await bot.db.BaseCoordinates.deleteCoordinate(id);

    res.send("deleted");
});

app.post("/coordinates", async (req, res) => {
    let buffer = [];

    req.on("data", (chunk) => {
        buffer.push(chunk);
    });

    req.on("end", async () => {
        let data = buffer.toString()

        if (!data) return res.send("Failed");

        await bot.db.BaseCoordinates.createCoordinate(data);

        res.send("Success");
    });
});

app.patch("/coordinates/:id", async (req, res) => {
    let id = req.params["id"] || "";

    if (id.length <= 0) {
        return res.send("invalid id");
    }

    let value = req.query["value"] || "";

    if (value.length <= 0) {
        return res.send("invalid value");
    }

    await bot.db.BaseCoordinates.updateCoordinate(id, value);

    res.send("success");
});

app.get("/coordinates", async (req, res) => {
    let coordinates = (await new bot.db.BaseCoordinates()).getList();

    let page = parseInt(req.query["page"]) || 0;
    let num = parseInt(req.query["num"]) || coordinates.length;

    let result = coordinates.slice((num * page), ((num * page) + num));

    res.setHeader("content-type", "application/json");
    res.send(JSON.stringify(result));
});

app.post("/shift", async (req, res) => {
    let buffer = [];

    req.on("data", (chunk) => {
        buffer.push(chunk);
    });

    req.on("end", async () => {
        let data = JSON.parse(buffer.toString());

        if (data === undefined) return res.send("Failed");

        await bot.db.ShiftType.createShift(data);

        res.send("Success");
    });
});

app.patch("/shift/:id/:type", async (req, res) => {
    let id = req.params["id"] || "";
    let type = req.params["type"] || "";

    if (id.length <= 0) {
        return res.send("invalid id");
    }

    if (type.length <= 0) {
        return res.send("invalid type");
    }

    let value = req.query["value"] || "";

    if (value.length <= 0) {
        return res.send("invalid value");
    }

    let shift = await new bot.db.Shift(id);

    if (type === "name") {
        shift.setName(value);

        return res.send("success");
    }

    if (type === "time_in") {
        shift.setTimeIn(value);

        return res.send("success");
    }

    if (type === "time_out") {
        shift.setTimeOut(value);

        return res.send("success");
    }

    res.send("failed");
});

app.delete("/shift/:id", async (req, res) => {
    let id = req.params["id"] || "";

    if (id.length <= 0) {
        return res.send("invalid id");
    }

    let shift = await new bot.db.Shift(id);
    await shift.delete();

    res.send("deleted");
});

app.post("/user", async (req, res) => {
    let buffer = [];

    req.on("data", (chunk) => {
        buffer.push(chunk);
    });

    req.on("end", async () => {
        let data = JSON.parse(buffer.toString());

        if (data === undefined) return res.send("Failed");

        await bot.db.Users.createUser(data);

        res.send("Success");
    });
});

app.delete("/user/:id", async (req, res) => {
    let id = req.params["id"] || "";

    if (id.length <= 0) {
        return res.send("invalid id");
    }

    let users = await new bot.db.Users();
    await users.deleteUserByID(id);

    res.send("deleted");
});

app.get("/user/admin/:id", async (req, res) => {
    let id = req.params["id"] || "";

    if (id.length <= 0) {
        return res.send("invalid id");
    }

    let user = await new bot.db.User(id);

    let is_admin = await user.isAdmin();

    res.send(is_admin.toString() || "0");
});

app.patch("/user/:id/:type", async (req, res) => {
    let id = req.params["id"] || "";
    let type = req.params["type"] || "";

    if (id.length <= 0) {
        return res.send("invalid id");
    }

    if (type.length <= 0) {
        return res.send("invalid type");
    }

    let value = req.query["value"] || "";

    if (value.length <= 0) {
        return res.send("invalid value");
    }

    let user = await new bot.db.User(id);

    if (type === "name") {
        user.setUserName(value);

        return res.send("success");
    }

    if (type === "phone") {
        user.setNoTelp(value);

        return res.send("success");
    }

    if (type === "shift") {
        user.setShiftId(value);

        return res.send("success");
    }

    res.send("failed");
});

app.get("/total/user", async (req, res) => {
    let users = await new bot.db.Users();
    let user_array = users.getUsers();

    let filterName = req.query["name"] || "";
    let filterPhoneNum = req.query["phone"] || "";
    let filterShift = req.query["shift"] || "";

    let result = user_array;

    if (filterName) {
        result = result.filter((v) => v.name.toLowerCase().includes(filterName.toLowerCase()));
    }

    if (filterShift) {
        result = result.filter((v) => v.shift.shift_name.toLowerCase().includes(filterShift.toLowerCase()));
    }

    if (filterPhoneNum) {
        if (filterPhoneNum.toLowerCase() === "unset") {
            result = result.filter((v) => v.phone_number.length === 0);
        } else {
            result = result.filter((v) => v.phone_number.toLowerCase().includes(filterPhoneNum.toLowerCase()));
        }
    }

    res.send(result.length.toString());
});


app.get("/total/coordinates", async (req, res) => {
    let coordinates = await new bot.db.BaseCoordinates();
    res.send(coordinates.getList().length.toString());
});

app.get("/total/shift", async (req, res) => {
    let shifts = await new bot.db.ShiftType();
    res.send(shifts.getShifts().size.toString());
});

app.get("/users", async (req, res) => {
    let users = await new bot.db.Users();
    let user_array = users.getUsers();

    // TODO: Add ID filter

    let page = parseInt(req.query["page"]) || 0;
    let num = parseInt(req.query["num"]) || user_array.length;
    let filterName = req.query["name"] || "";
    let filterPhoneNum = req.query["phone"] || "";
    let filterShift = req.query["shift"] || "";

    let result = user_array.slice((num * page), ((num * page) + num));

    if (filterName) {
        result = result.filter((v) => v.name.toLowerCase().includes(filterName.toLowerCase()));
    }

    if (filterShift) {
        result = result.filter((v) => v.shift.shift_name.toLowerCase().includes(filterShift.toLowerCase()));
    }

    if (filterPhoneNum) {
        if (filterPhoneNum.toLowerCase() === "unset") {
            result = result.filter((v) => v.phone_number.length === 0);
        } else {
            result = result.filter((v) => v.phone_number.toLowerCase().includes(filterPhoneNum.toLowerCase()));
        }
    }

    res.setHeader("content-type", "application/json");
    res.send(JSON.stringify(result));
});

app.get("/shifts", async (req, res) => {
    let shifts = await new bot.db.ShiftType();
    let shift_array = Array.from(shifts.getShifts().values());

    let page = parseInt(req.query["page"]) || 0;
    let num = parseInt(req.query["num"]) || shift_array.length;
    let filterId = req.query["id"] || "";
    let filterName = req.query["name"] || "";

    let result = shift_array.slice((num * page), ((num * page) + num));

    result = result.map((v) => {
        return {
            shift_name: v.shift_name,
            shift_id: v.shift_id,
            time_in: `${v.time_in.start.hour.toString().padStart(2, "0")}:${v.time_in.start.minutes.toString().padStart(2, "0")}-${v.time_in.end.hour.toString().padStart(2, "0")}:${v.time_in.end.minutes.toString().padStart(2, "0")}`,
            time_out: `${v.time_out.start.hour.toString().padStart(2, "0")}:${v.time_out.start.minutes.toString().padStart(2, "0")}-${v.time_out.end.hour.toString().padStart(2, "0")}:${v.time_out.end.minutes.toString().padStart(2, "0")}`
        };
    })

    if (filterId) {
        result = result.filter((v) => v.shift_id.toString().includes(filterId));
    }

    if (filterName) {
        result = result.filter((v) => v.shift_name.toLowerCase().includes(filterName.toLowerCase()));
    }

    res.setHeader("content-type", "application/json");
    res.send(JSON.stringify(result));
});

app.get("/", async (req, res) => {
    if (await bot.isRunning()) {
        startRequest = false;
        return res.send("Running");
    } else {
        if (startRequest) {
            return res.send("Starting");
        }
        return res.send("Stopped");
    }
});

app.post("/", (req, res) => {
    let buffer = [];

    req.on("data", (chunk) => {
        buffer.push(chunk);
    });

    req.on("end", async () => {
        let state = buffer.toString().toLowerCase();

        if (state === "start") {
            if (startRequest) {
                return res.send("Already Starting");
            }

            if (!(await bot.isRunning())) {
                bot.start();
                startRequest = true;
                return res.send("Success Start Request");
            }

            return res.send("Already Started");
        }

        if (state === "stop") {
            if ((await bot.isRunning())) {
                bot.stop();
                startRequest = false;
                return res.send("Success Stop Request");
            }

            if (startRequest) {
                return res.send("Starting, Cannot Stop");
            }

            return res.send("Already Stopped");
        }

        res.send("Failed");
    });
})

let listener = app.listen("5678", "0.0.0.0", () => {
    bot.start();
    console.log(`API Started at ${listener.address().address}:${listener.address().port}`);
});