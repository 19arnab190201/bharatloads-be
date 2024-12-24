const sendToken = (user, res) => {
  const token = user.getJwtToken();

  user.password = undefined;
  res.status(200).json({
    success: true,
    token,
    user,
  });
};

module.exports = sendToken;
