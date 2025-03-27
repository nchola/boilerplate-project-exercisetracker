const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Database Connection
mongoose.connect(process.env.DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Models
const UserSchema = new Schema(
  {
    username: String,
  },
  { collection: "users" },
);

const ExerciseSchema = new Schema(
  {
    user_id: { type: String, required: true },
    description: String,
    duration: { type: Number, required: true },
    date: { type: Date, default: Date.now },
  },
  { collection: "exercises" },
);

const User = mongoose.model("User", UserSchema);
const Exercise = mongoose.model("Exercise", ExerciseSchema);

// Routes
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// POST /api/users
app.post("/api/users", async (req, res) => {
  console.log("\n=== POST /api/users ===");
  console.log("Body:", req.body);

  try {
    if (!req.body.username) {
      console.log("Username missing");
      return res.status(400).json({ error: "Username is required" });
    }

    const newUser = new User({ username: req.body.username });
    const savedUser = await newUser.save();

    console.log("User created:", savedUser);
    res.json({
      _id: savedUser._id,
      username: savedUser.username,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users
app.get("/api/users", async (req, res) => {
  console.log("\n=== GET /api/users ===");

  try {
    const users = await User.find({}).select("_id username");
    console.log("Found users:", users.length);

    res.json(users);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/users/:_id/exercises
app.post("/api/users/:_id/exercises", async (req, res) => {
  console.log("\n=== POST /api/users/:id/exercises ===");
  console.log("Params:", req.params);
  console.log("Body:", req.body);

  try {
    // Validate input
    if (!req.body.description || !req.body.duration) {
      return res
        .status(400)
        .json({ error: "Description and duration are required" });
    }

    // Find user
    const user = await User.findById(req.params._id);
    if (!user) {
      console.log("User not found");
      return res.status(404).json({ error: "User not found" });
    }

    // Create exercise
    const exercise = new Exercise({
      user_id: user._id,
      description: req.body.description,
      duration: parseInt(req.body.duration),
      date: req.body.date ? new Date(req.body.date) : new Date(),
    });

    const savedExercise = await exercise.save();

    console.log("Exercise created:", savedExercise);

    res.json({
      _id: user._id,
      username: user.username,
      date: savedExercise.date.toDateString(),
      duration: savedExercise.duration,
      description: savedExercise.description,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/:_id/logs
app.get("/api/users/:_id/logs", async (req, res) => {
  console.log("\n=== GET /api/users/:id/logs ===");
  console.log("Params:", req.params);
  console.log("Query:", req.query);

  try {
    // Find user
    const user = await User.findById(req.params._id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Build filter
    const filter = { user_id: req.params._id };
    const dateFilter = {};

    if (req.query.from) {
      dateFilter["$gte"] = new Date(req.query.from);
    }
    if (req.query.to) {
      dateFilter["$lte"] = new Date(req.query.to);
    }
    if (req.query.from || req.query.to) {
      filter.date = dateFilter;
    }

    // Query exercises
    let query = Exercise.find(filter);
    if (req.query.limit) {
      query = query.limit(parseInt(req.query.limit));
    }

    const exercises = await query.exec();

    console.log("Found exercises:", exercises.length);

    res.json({
      _id: user._id,
      username: user.username,
      count: exercises.length,
      log: exercises.map((ex) => ({
        description: ex.description,
        duration: ex.duration,
        date: ex.date.toDateString(),
      })),
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Error Handling
app.use((err, req, res, next) => {
  console.error("Global Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Server Start
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Server started on port " + listener.address().port);
});

// Database Connection Events
mongoose.connection.on("connected", () => {
  console.log("Connected to MongoDB Atlas");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});
