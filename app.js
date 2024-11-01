const express = require('express');
const jwt = require("jsonwebtoken");
let cors = require('cors');
const routerTeachers = require('./routers/routerTeacher');
const routerStudents = require('./routers/routerStudents');
const routerClassrooms = require('./routers/routerClassrooms');
const database = require('./database');
require('dotenv').config();

const port = process.env.PORT;
const app = express();

app.use(cors());

app.use(express.json());

app.use("/teachers", routerTeachers);
app.use("/students", routerStudents);
app.use("/classrooms", routerClassrooms);

let findRefreshToken = async (refreshToken) => {

    database.connect();
    try {
        let refreshTokenResponse = await database.query('SELECT refreshToken FROM refreshTokens WHERE refreshToken = ?', [refreshToken]);
        if (refreshTokenResponse.length <= 0) return false;
        return true;
    } catch {
        return false;
    } finally {
        database.disconnect();
    }
};

app.post('/token', async (req, res) => {
    let refreshToken = req.body.refreshToken;
    if (!refreshToken) {
        console.log("No refreshToken provided " + Date.now());
        return res.status(401).json({ error: "Unauthorized" });
    }
    if (!findRefreshToken(refreshToken)) {
        console.log("There is no refreshToken in the DB " + Date.now());
        database.connect();
        try {
            await database.query('DELETE FROM refreshTokens WHERE refreshToken = ?', [refreshToken]);
        } catch {
            return false;
        } finally {
            database.disconnect();
        }
        return res.status(403).json({ error: "Forbidden" });
    }

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
        if (err) {
            console.log("The refreshToken is not valid " + Date.now());
            database.connect();
            try {
                await database.query('DELETE FROM refreshTokens WHERE refreshToken = ?', [refreshToken]);
            } catch {
                return false;
            } finally {
                database.disconnect();
            }
            return res.status(403).json({ error: "Forbidden" });
        }

        const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '0.3h' });
        res.status(200).json(accessToken);
    });
});

app.post('/logout', async (req, res) => {
    let refreshToken = req.body.token;
    database.connect();
    try {
        await database.query('DELETE FROM refreshTokens WHERE refreshToken = ?', [refreshToken]);
    } catch {
        return false;
    } finally {
        database.disconnect();
    }
    res.status(204).json({ message: "No content" });
});

app.listen(port, () => {
    console.log("Active server listening on port", port);
});