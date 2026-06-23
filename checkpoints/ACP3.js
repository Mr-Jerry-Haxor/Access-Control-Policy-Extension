import {
    pass,
    fail
}
from "./utils.js";

const ACP3 = {

    id: "ACP3",

    name: "Checkpoint 3",

    category: "Access",

    type: "RULE",

    async validate(context) {

        const valid = true;

        return valid

            ? pass(
                this.id,
                "Validation passed"
            )

            : fail(
                this.id,
                "Validation failed"
            );
    }
};

export default ACP3;