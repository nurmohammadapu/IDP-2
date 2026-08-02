const { createTest, getAllTests, getTestById, updateTest, deleteTest } = require("../models/testModel")

async function getAll(req, res) {
  try {
    const tests = await getAllTests()
    return res.json(tests)
  } catch (error) {
    console.error("Get tests error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params
    const test = await getTestById(id)
    if (!test) {
      return res.status(404).json({ error: "Test not found" })
    }
    return res.json(test)
  } catch (error) {
    console.error("Get test error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function create(req, res) {
  try {
    const { name, category, price, description } = req.body

    if (!name || !category || !price) {
      return res.status(400).json({ error: "Name, category, and price are required" })
    }

    const testId = await createTest({
      name,
      category,
      price,
      description,
    })

    return res.status(201).json({ message: "Test created successfully", testId })
  } catch (error) {
    console.error("Create test error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function update(req, res) {
  try {
    const { id } = req.params
    const { name, category, price, description } = req.body

    if (!name || !category || !price) {
      return res.status(400).json({ error: "Name, category, and price are required" })
    }

    await updateTest(id, {
      name,
      category,
      price,
      description,
    })

    return res.json({ message: "Test updated successfully" })
  } catch (error) {
    console.error("Update test error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function deleteTestById(req, res) {
  try {
    const { id } = req.params
    await deleteTest(id)
    return res.json({ message: "Test deleted successfully" })
  } catch (error) {
    console.error("Delete test error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteTestById,
}
