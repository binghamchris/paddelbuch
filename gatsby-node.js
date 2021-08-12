exports.createSchemaCustomization = ({
  actions: { createTypes, printTypeDefinitions }
}) => {
  createTypes(`
  type Locale implements Node {
    language: GraphCMS_Locale
  }
  `);
};
