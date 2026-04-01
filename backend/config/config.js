const common = {
  dialect: "postgres",
  logging: process.env.SEQUELIZE_LOGGING === "true" ? console.log : false
};

module.exports = {
  development: {
    ...common,
    url: process.env.DATABASE_URL
  },
  test: {
    ...common,
    url: process.env.DATABASE_URL
  },
  production: {
    ...common,
    url: process.env.DATABASE_URL,
    dialectOptions: process.env.PGSSLMODE === "require" ? { ssl: { require: true, rejectUnauthorized: false } } : {}
  }
};

