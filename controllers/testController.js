const { createTest, getAllTests, getTestById, updateTest, deleteTest } = require("../models/testModel")

async function getAll(req, res) {
  try {
    const tests = await getAllTests()
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(tests))
  } catch (error) {
    console.error("Get tests error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function getById(req, res, id) {
  try {
    const test = await getTestById(id)
    if (!test) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Test not found" }))
      return
    }
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(test))
  } catch (error) {
    console.error("Get test error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function create(req, res) {
  try {
    const { name, category, price, description } = req.body

    if (!name || !category || !price) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Name, category, and price are required" }))
      return
    }

    const testId = await createTest({
      name,
      category,
      price,
      description,
    })

    res.writeHead(201, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Test created successfully", testId }))
  } catch (error) {
    console.error("Create test error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function update(req, res, id) {
  try {
    const { name, category, price, description } = req.body

    if (!name || !category || !price) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Name, category, and price are required" }))
      return
    }

    await updateTest(id, {
      name,
      category,
      price,
      description,
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Test updated successfully" }))
  } catch (error) {
    console.error("Update test error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

async function deleteTestById(req, res, id) {
  try {
    await deleteTest(id)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ message: "Test deleted successfully" }))
  } catch (error) {
    console.error("Delete test error:", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Internal server error" }))
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteTestById,
}
