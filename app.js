// app.js - Main server file for CodeCraftHub API
// A simple REST API for managing learning courses

// ============================================
// IMPORTS AND SETUP
// ============================================

const express = require('express') // Express framework for building REST APIs
const fs = require('fs').promises // File system module with promises (for async/await)
const path = require('path') // Path module for handling file paths

const app = express() // Create Express application
const PORT = 5000 // Server port number
const DATA_FILE = path.join(__dirname, 'courses.json') // Path to JSON data file

// Middleware to parse JSON request bodies
// This allows us to access req.body in POST and PUT requests
app.use(express.json())

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Initialize the JSON data file if it doesn't exist
 * Creates an empty courses array structure
 */
async function initializeDataFile() {
  try {
    // Try to access the file
    await fs.access(DATA_FILE)
    console.log('Data file found:', DATA_FILE)
  } catch (error) {
    // File doesn't exist, create it with empty courses array
    console.log('Data file not found. Creating new file...')
    const initialData = { courses: [] }
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2))
    console.log('Data file created successfully')
  }
}

/**
 * Read all courses from the JSON file
 * @returns {Promise<Array>} Array of course objects
 */
async function readCourses() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8')
    const parsedData = JSON.parse(data)
    return parsedData.courses || []
  } catch (error) {
    // If there's an error reading the file, return empty array
    console.error('Error reading courses:', error.message)
    return []
  }
}

/**
 * Write courses to the JSON file
 * @param {Array} courses - Array of course objects to save
 */
async function writeCourses(courses) {
  try {
    const data = { courses }
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error writing courses:', error.message)
    throw new Error('Failed to save data')
  }
}

/**
 * Validate course data
 * @param {Object} course - Course object to validate
 * @returns {Object} Validation result with isValid flag and error message
 */
function validateCourse(course) {
  const { name, description, target_date, status } = course

  // Check if all required fields are present
  if (!name || !description || !target_date || !status) {
    return {
      isValid: false,
      message:
        'Missing required fields. Please provide: name, description, target_date, status',
    }
  }

  // Validate status value
  const validStatuses = ['Not Started', 'In Progress', 'Completed']
  if (!validStatuses.includes(status)) {
    return {
      isValid: false,
      message:
        'Invalid status. Status must be: "Not Started", "In Progress", or "Completed"',
    }
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(target_date)) {
    return {
      isValid: false,
      message: 'Invalid date format. Please use YYYY-MM-DD',
    }
  }

  return { isValid: true }
}

// ============================================
// API ENDPOINTS
// ============================================

/**
 * GET /api/courses
 * Retrieve all courses
 */
app.get('/api/courses', async (req, res) => {
  try {
    // Read all courses from the JSON file
    const courses = await readCourses()

    // Send the courses as JSON response
    res.json({
      success: true,
      count: courses.length,
      data: courses,
    })
  } catch (error) {
    // Handle any server errors
    res.status(500).json({
      success: false,
      error: 'Failed to fetch courses',
    })
  }
})


// ============================================
// NEW ENDPOINT: GET /api/courses/stats
// Returns statistics about all courses
// ============================================
/**
 * GET /api/courses/stats
 * Retrieve statistics about courses
 * Returns:
 * - Total number of courses
 * - Count of courses by status (Not Started, In Progress, Completed)
 */
app.get('/api/courses/stats', async (req, res) => {
  try {
    // Read all courses
    const courses = await readCourses()

    // Calculate total number of courses
    const totalCourses = courses.length

    // Initialize counters for each status
    let notStarted = 0
    let inProgress = 0
    let completed = 0

    // Count courses by status
    courses.forEach((course) => {
      switch (course.status) {
        case 'Not Started':
          notStarted++
          break
        case 'In Progress':
          inProgress++
          break
        case 'Completed':
          completed++
          break
        // If there are any courses with invalid status, they won't be counted
      }
    })

    // Calculate completion rate (percentage of completed courses)
    const completionRate =
      totalCourses > 0 ? Math.round((completed / totalCourses) * 100) : 0

    // Return the statistics
    res.json({
      success: true,
      data: {
        totalCourses,
        byStatus: {
          notStarted,
          inProgress,
          completed,
        },
        completionRate: `${completionRate}%`,
        summary: {
          notStarted: `${notStarted} course${notStarted !== 1 ? 's' : ''} to start`,
          inProgress: `${inProgress} course${inProgress !== 1 ? 's' : ''} in progress`,
          completed: `${completed} course${completed !== 1 ? 's' : ''} completed`,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch course statistics',
    })
  }
})

/**
 * GET /api/courses/:id
 * Retrieve a specific course by ID
 */
app.get('/api/courses/:id', async (req, res) => {
  try {
    // Convert id parameter to number
    const courseId = parseInt(req.params.id)

    // Check if id is valid
    if (isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid course ID format',
      })
    }

    // Read all courses
    const courses = await readCourses()

    // Find the course with matching ID
    const course = courses.find((c) => c.id === courseId)

    // If course not found, return 404
    if (!course) {
      return res.status(404).json({
        success: false,
        error: `Course with ID ${courseId} not found`,
      })
    }

    // Send the found course
    res.json({
      success: true,
      data: course,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch course',
    })
  }
})

/**
 * POST /api/courses
 * Create a new course
 */
app.post('/api/courses', async (req, res) => {
  try {
    // Get course data from request body
    const newCourseData = req.body

    // Validate the course data
    const validation = validateCourse(newCourseData)
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.message,
      })
    }

    // Read existing courses
    const courses = await readCourses()

    // Generate new ID (increment by 1 from the highest existing ID, or start at 1)
    const newId =
      courses.length > 0 ? Math.max(...courses.map((c) => c.id)) + 1 : 1

    // Create complete course object with generated fields
    const newCourse = {
      id: newId,
      name: newCourseData.name,
      description: newCourseData.description,
      target_date: newCourseData.target_date,
      status: newCourseData.status,
      created_at: new Date().toISOString(), // Auto-generate timestamp
    }

    // Add new course to array
    courses.push(newCourse)

    // Save updated courses back to file
    await writeCourses(courses)

    // Return the created course with 201 Created status
    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: newCourse,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create course',
    })
  }
})

/**
 * PUT /api/courses/:id
 * Update an existing course
 */
app.put('/api/courses/:id', async (req, res) => {
  try {
    // Get course ID from URL parameter
    const courseId = parseInt(req.params.id)

    // Check if id is valid
    if (isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid course ID format',
      })
    }

    // Get update data from request body
    const updateData = req.body

    // Read existing courses
    const courses = await readCourses()

    // Find the course index
    const courseIndex = courses.findIndex((c) => c.id === courseId)

    // If course not found, return 404
    if (courseIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Course with ID ${courseId} not found`,
      })
    }

    // If status is being updated, validate it
    if (updateData.status) {
      const validStatuses = ['Not Started', 'In Progress', 'Completed']
      if (!validStatuses.includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          error:
            'Invalid status. Status must be: "Not Started", "In Progress", or "Completed"',
        })
      }
    }

    // If target_date is being updated, validate format
    if (updateData.target_date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(updateData.target_date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Please use YYYY-MM-DD',
        })
      }
    }

    // Update the course (only fields that are provided)
    const updatedCourse = {
      ...courses[courseIndex], // Keep existing fields
      ...updateData, // Override with updated fields
      id: courseId, // Ensure ID doesn't change
      updated_at: new Date().toISOString(), // Add update timestamp
    }

    // Replace old course with updated version
    courses[courseIndex] = updatedCourse

    // Save updated courses to file
    await writeCourses(courses)

    // Return updated course
    res.json({
      success: true,
      message: 'Course updated successfully',
      data: updatedCourse,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update course',
    })
  }
})

/**
 * DELETE /api/courses/:id
 * Delete a course
 */
app.delete('/api/courses/:id', async (req, res) => {
  try {
    // Get course ID from URL parameter
    const courseId = parseInt(req.params.id)

    // Check if id is valid
    if (isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid course ID format',
      })
    }

    // Read existing courses
    const courses = await readCourses()

    // Find the course index
    const courseIndex = courses.findIndex((c) => c.id === courseId)

    // If course not found, return 404
    if (courseIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Course with ID ${courseId} not found`,
      })
    }

    // Remove course from array
    courses.splice(courseIndex, 1)

    // Save updated courses to file
    await writeCourses(courses)

    // Return success with no content (204)
    res.status(204).send()
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete course',
    })
  }
})

/**
 * GET /
 * Welcome route with API information
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to CodeCraftHub API',
    description: 'A simple learning platform API for managing courses',
    version: '1.0.0',
    endpoints: {
      'GET /api/courses': 'Get all courses',
      'GET /api/courses/:id': 'Get a specific course by ID',
      'GET /api/courses/stats': 'Get course statistics', // NEW endpoint added here
      'POST /api/courses': 'Create a new course',
      'PUT /api/courses/:id': 'Update an existing course',
      'DELETE /api/courses/:id': 'Delete a course',
    },
    example_course: {
      name: 'Node.js Basics',
      description: 'Learn Node.js fundamentals',
      target_date: '2024-12-31',
      status: 'Not Started',
    },
  })
})

// ============================================
// START THE SERVER
// ============================================

/**
 * Initialize data file and start the server
 */
async function startServer() {
    try {
        // Make sure data file exists before starting server
        await initializeDataFile();
        
        // Start listening for requests
        app.listen(PORT, () => {
            console.log('=================================');
            console.log(`CodeCraftHub API is running!`);
            console.log(`Server URL: http://localhost:${PORT}`);
            console.log(`Data file: ${DATA_FILE}`);
            console.log('=================================');
            console.log('Available endpoints:');
            console.log(`- GET    http://localhost:${PORT}/api/courses`);
            console.log(`- GET    http://localhost:${PORT}/api/courses/stats`);
            console.log(`- GET    http://localhost:${PORT}/api/courses/:id`);  // Fixed: now shows :id correctly
            console.log(`- POST   http://localhost:${PORT}/api/courses`);
            console.log(`- PUT    http://localhost:${PORT}/api/courses/:id`);  // Fixed: now shows :id correctly
            console.log(`- DELETE http://localhost:${PORT}/api/courses/:id`); // Fixed: now shows :id correctly            
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

// Start the server
startServer()
