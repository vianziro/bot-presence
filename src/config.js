const toml = require("toml");
const fs = require("fs");
const concat = require("concat-stream");
const { DateTime } = require("luxon");

class Config {
    #config;

    constructor() {
        return new Promise((resolve) => {
            fs.createReadStream("./config.toml", "utf8").pipe(concat((buffer) => {
                this.#config = toml.parse(buffer);
                resolve(this);
            }));
        });
    }

    /**
     * @returns {{ requestTimeout: Number, timezone: String }}
     */
    get botSetting() {
        let base = this.#config["bot_setting"];

        return {
            requestTimeout: base["request_timeout"],
            timezone: base["timezone"],
        };
    }

    get lang() {
        let base = this.#config["language"];

        return {
            bot_ready: base["bot_ready"]
        }
    }

    getMessage(parsed) {
        let base = this.#config["message"];
        let notDefined = "[placeholder not defined]";

        parsed.currentTime = (typeof parsed.currentTime === "undefined" ? { hour: notDefined, minute: notDefined } : parsed.currentTime);
        parsed.checkin = (typeof parsed.checkin === "undefined" ? { hour: notDefined, minute: notDefined } : parsed.checkin);
        parsed.checkout = (typeof parsed.checkout === "undefined" ? { hour: notDefined, minute: notDefined } : parsed.checkout);

        for (let element in base) {
            base[element] = base[element]
            .replace("{currentTime.day}", parsed.currentTime.day)
            .replace("{currentTime.month}", parsed.currentTime.month)
            .replace("{currentTime.year}", parsed.currentTime.year)
            .replace("{checkin.hour}", parsed.checkin.hour.toString().padStart(2, '0'))
            .replace("{checkin.minute}", parsed.checkin.minute.toString().padStart(2, '0'))
            .replace("{checkout.hour}", parsed.checkout.hour.toString().padStart(2, '0'))
            .replace("{checkout.minute}", parsed.checkout.minute.toString().padStart(2, '0'))
            .replace("{user.number}", parsed.userNumber)
            .replace("{user.name}", parsed.userName)
            .replace("{shift.name}", parsed.shiftName)
            .replace("{instance_name}", parsed.instance_name)
            .replace("{message}", parsed.message)
            .trim()
        }

        return {
            presence_empty: base["presence_empty"],
            presence_check_in: base["presence_check_in"],
            presence_check_in_out: base["presence_check_in_out"],
            must_live_location: base["must_live_location"],
            id_not_found: base["id_not_found"],
            forward_forbidden: base["forward_forbidden"],
            radius_too_far: base["radius_too_far"],
            id_cannot_search: base["id_cannot_search"],
            id_already_defined: base["id_already_defined"],
            command_usage: base["command_usage"],
            success_define_number: base["success_define_number"],
            already_check_in: base["already_check_in"],
            not_checkin_time_before: base["not_checkin_time_before"],
            not_checkin_time_after: base["not_checkin_time_after"],
            send_location: base["send_location"],
            already_check_out: base["already_check_out"],
            not_checkout_time_before: base["not_checkout_time_before"],
            not_checkout_time_after: base["not_checkout_time_after"],
            not_yet_checkin: base["not_yet_checkin"],
            message_template: base["message_template"],
        }
    }
}

process.on("uncaughtException", (ev) => {
    console.error(ev);
    return false;
});

// function orUndefined(value) {
//     return (typeof value === "undefined" ? "undefined" : value);
// }

module.exports = Config;
