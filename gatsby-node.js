const { createFilePath } = require(`gatsby-source-filesystem`)
exports.onCreateNode = ({ node, actions, getNode }) => {
  const { createNodeField } = actions
  if (node.internal.type === `graphCmsTour`) {
    const value = createFilePath({ node, getNode })
    createNodeField({
      name: `id`,
      node,
      value,
    })
  }
}