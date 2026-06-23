export function pass(
    checkpointId,
    message,
    additionalData = {}
) {

    return {

        checkpointId,

        status: "PASS",

        message,

        ...additionalData
    };
}

export function fail(
    checkpointId,
    message,
    additionalData = {}
) {

    return {

        checkpointId,

        status: "FAIL",

        message,

        ...additionalData
    };
}

export function warning(
    checkpointId,
    message,
    additionalData = {}
) {

    return {

        checkpointId,

        status: "WARNING",

        message,

        ...additionalData
    };
}

export function getAnswer(
    context,
    questionId
) {

    return (
        context.answerMap.get(
            questionId
        ) || null
    );
}

export function getAnswerText(
    context,
    questionId
) {

    const answer =
        getAnswer(
            context,
            questionId
        );

    if (!answer) {

        return "";
    }

    return (

        answer.answer ||

        answer.response ||

        answer.value ||

        ""
    );
}