const cron = require("node-cron");
const express = require("express");
const findRemoveSync = require('find-remove')

const app = express();
let folder = `${__dirname}/converted`;
cron.schedule("0 0 */1 * * *", function () {
    findRemoveSync(folder, {
        age: { seconds: 5400 },
        dir: '*'
    });
});

app.listen(3002, () => {
  
});