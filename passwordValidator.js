function checkPassword(password) {
    const minLength = 8;
    const uppercase = /[A-Z]/;
    const lowercase = /[a-z]/;
    const digit = /[0-9]/;
    const specialChar = /[!@#$%^&*]/;

    return password.length >= minLength &&
        uppercase.test(password) &&
        lowercase.test(password) &&
        digit.test(password) &&
        specialChar.test(password);
}

module.exports = { checkPassword };
