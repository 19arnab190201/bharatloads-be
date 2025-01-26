const axios = require("axios");

exports.sendOTP = async (phone, otp) => {
    if(process.env.ENVIRONMENT === "development"){
        console.log('OTP', otp, phone);
        return true
    }
    try {
        const response = await axios.get(
            `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMS_API_KEY}&route=dlt&sender_id=${process.env.FAST2SMS_SENDER_ID}&message=${process.env.FAST2SMS_MESSAGE}&variables_values=${otp}%7C&flash=0&numbers=${phone}`
        )
        console.log(response.data)
        return true
    } catch (error) {
        console.log(error)
        return false
    }
}