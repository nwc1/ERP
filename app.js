const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const indexRouter = require('./routes/index');
const Student = require('./models/student');
const Teacher = require('./models/teacher');
const Placement = require('./models/placement');
const bcrypt = require('bcrypt');
const xlsx = require('xlsx');

const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/placement', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Set view engine and static directory
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Express session middleware
app.use(session({
    secret: 'secret', // Change this to a random string
    resave: true,
    saveUninitialized: true
}));

// Routes
app.use('/', indexRouter);

app.get('/', (req, res) => {
    res.render('home');
});

// Handle student registration form submission
app.post('/student/register', async (req, res) => {
    const { roll, name, email, password, age, college, placementStatus, graduation, pgraduation, experience, phoneNumber, placeOfBirth, tenthPercentage, twelfthPercentage } = req.body;

    try {
        // Check if the student already exists
        const existingTeacher = await Teacher.findOne({ email });
        const existingStudent = await Student.findOne({ email });
        if (existingStudent || existingTeacher) {
            return res.redirect('/student/register?success=false');
        }

        // Hash the password
        bcrypt.hash(password, 8, async (err, hashedPassword) => {
            if (err) {
                return res.status(500).send('Error hashing password');
            }

            try {
                // Create a new student instance with the hashed password
                const newStudent = new Student({
                    roll,
                    name,
                    email,
                    password: hashedPassword,
                    age,
                    college,
                    placementStatus,
                    graduation,
                    pgraduation,
                    experience,
                    phoneNumber,
                    placeOfBirth,
                    tenthPercentage,
                    twelfthPercentage
                    // Add more fields as needed
                });

                // Save the student to the database
                await newStudent.save();
                return res.redirect('/student/login?success=true');
                //res.render('student_login');

            } catch (error) {
                console.error('Error saving student:', error);
                res.status(500).send('Internal Server Error');
            }
        });
    } catch (error) {
        console.error('Error registering student:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Handle student login form submission
app.post('/student/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Check if the student exists in the database
        const student = await Student.findOne({ email });
        if (!student) {
            return res.status(400).send('Invalid email or password');
        }

        // Compare the password using bcrypt.compare
        bcrypt.compare(password, student.password, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.status(500).send('Internal Server Error');
            }
            // If password matches, isMatch will be true
            if (isMatch) {
                // Store student ID in session
                req.session.studentId = student._id;
                // Redirect to dashboard
                res.redirect('/student/dashboard');
            } else {
                // Password does not match
                return res.status(400).send('Invalid email or password');
            }
        });
    } catch (error) {
        console.error('Error logging in student:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/teacher/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        // Check if the teacher already exists
        const existingTeacher = await Teacher.findOne({ email });
        if (existingTeacher) {
            return res.status(400).send('email already exists');
        }

        // Check if the email exists in the Student collection
        const existingStudent = await Student.findOne({ email });
        if (existingStudent) {
            return res.status(400).send('email already exists');
        }
        
        // Create a new teacher instance with the plaintext password
        const newTeacher = new Teacher({ name, email, password });
        // Save the teacher to the database
        await newTeacher.save();
        res.status(201).send('Teacher registered successfully');
    } catch (error) {
        console.error('Error registering Teacher:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/teacher/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Check if the teacher exists in the database
        const teacher = await Teacher.findOne({ email });
        if (!teacher) {
            return res.status(400).send('Invalid email or password');
        }
        
        // Compare plaintext passwords
        if (password === teacher.password) {
            // Store teacher ID in session
            req.session.teacherId = teacher._id;
            // Redirect to dashboard or render a dashboard view
            res.redirect('/teacher/dashboard');
        } else {
            // Password does not match
            return res.status(400).send('Invalid email or password');
        }
    } catch (error) {
        console.error('Error logging in Teacher:', error);
        res.status(500).send('Internal Server Error');
    }
});



// Route to render student dashboard
app.get('/student/dashboard', async (req, res) => {
    try {
        const studentId = req.session.studentId;

        if (!studentId) {
            // User is not authenticated, redirect to login page
            return res.redirect('/student/login');
        }

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).send('Student not found');
        }

        // Prevent caching of the dashboard page
        res.setHeader('Cache-Control', 'no-store');

        // Pass the student object to the view
        res.render('student_dashboard', { student: student }); // or simply { student }
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/teacher/dashboard', async (req, res) => {
    try {
        const teacherId = req.session.teacherId;

        if (!teacherId) {
            // If teacher is not authenticated, redirect to the login page
            return res.redirect('/teacher/login');
        }

        const teacher = await Teacher.findById(teacherId);

        if (!teacher) {
            return res.status(404).send('Teacher not found');
        }

        // Prevent caching of the dashboard page
        res.setHeader('Cache-Control', 'no-store');

        // Render the teacher dashboard view with relevant data
        res.render('teacher_dashboard', { teacher });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/student/update', async (req, res) => {
    try {
        const studentIds = req.session.studentId;

        if (!studentIds) {
            // User is not authenticated, redirect to login page
            return res.redirect('/student/login');
        }

        const students = await Student.findById(studentIds);

        if (!students) {
            return res.status(404).send('Student not found');
        }
        res.setHeader('Cache-Control', 'no-store');
        // Render the update form with the student data
        res.render('update_registration_form', { students });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/dashboard', (req, res) => {
    res.render('student_dashboard');
});



app.get('/add-placement-drive', async (req, res) => {
    try {
        const teacherId = req.session.teacherId;

        if (!teacherId) {
            // If teacher is not authenticated, redirect to the login page
            return res.redirect('/teacher/login');
        }

        const teacher = await Teacher.findById(teacherId);

        if (!teacher) {
            return res.status(404).send('Teacher not found');
        }

        // Prevent caching of the dashboard page
        res.setHeader('Cache-Control', 'no-store');

        // Render the teacher dashboard view with relevant data
        res.render('add_placement_drive');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/view-placement-details', async (req, res) => {
    try {
        const teacherId = req.session.teacherId;
        const studentId = req.session.studentId;

        if (!teacherId && !studentId) {
            // If teacher is not authenticated, redirect to the login page
            return res.redirect('/');
        }
        // Prevent caching of the dashboard page
        res.setHeader('Cache-Control', 'no-store');
        const placements = await Placement.find();
        if (teacherId){
            res.render('view_placement_details', { placements });  
        }
        else if (studentId){
            res.render('stud_placement', { placements });  
        }
         
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/view_student', async (req, res) => {
    try {
        const teacherId = req.session.teacherId;

        if (!teacherId) {
            // If teacher is not authenticated, redirect to the login page
            return res.redirect('/teacher/login');
        }
        // Prevent caching of the dashboard page
        res.setHeader('Cache-Control', 'no-store');
        const students = await Student.find();
        res.render('view_student', { students });
         
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});




app.post('/add_placement_drive', async (req, res) => {
    const { companyName, jobProfile, description, location, date } = req.body;

    const newPlacement = new Placement({
        companyName,
        jobProfile,
        description,
        location,
        date
    });

    await newPlacement.save();
    res.redirect('/view-placement-details');
});



app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.redirect('/'); // Redirect to the home page after logout
        }
    });
});

app.get('/teacher/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            res.status(500).send('Internal Server Error');
        } else {
            console.log("Teacher logged out");
            res.redirect('/'); // Redirect to the teacher login page after logout
        }
    });
});

app.get('/view_student/download', async (req, res) => {
    try {
      // Retrieve data from MongoDB
      const data = await Student.find({});
  
      // Convert data to Excel format
      const formattedData = data.map(student => ({
        Email: student.email,
       // Password: student.password,
        Roll: student.roll,
        Name: student.name,
        Age: student.age,
        College: student.college,
        PlacementStatus: student.placementStatus,
        GraduationCGPA: student.graduation,
        PostGraduationCGPA: student.pgraduation,
        Certification: student.experience,
        PhoneNumber: student.phoneNumber,
        PlaceOfBirth: student.placeOfBirth,
        TenthPercentage: student.tenthPercentage,
        TwelfthPercentage: student.twelfthPercentage
    }));
  
    const worksheet = xlsx.utils.json_to_sheet(formattedData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Students');
      const excelFilePath = path.join(__dirname, 'students.xlsx');
      xlsx.writeFile(workbook, excelFilePath);
  
      // Serve the Excel file as a download
      res.download(excelFilePath, 'students.xlsx', (err) => {
        if (err) {
          console.error(err);
          res.status(500).send('Internal Server Error');
        }
        // Remove the Excel file after download
        fs.unlinkSync(excelFilePath);
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
});


app.get('/success', (req, res) => {
    res.render('<script>alert("Student details updated successfully");</script>');
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
