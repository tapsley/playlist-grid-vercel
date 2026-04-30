export const typeDefs = `
  enum ApplicationStatus {
    APPLIED
    PHONE_SCREEN
    INTERVIEW
    OFFER
    REJECTED
    WITHDRAWN
  }

  type ApplicationEvent {
    date: String!
    description: String!
  }

  type Application {
    id: ID!
    company: String!
    role: String!
    status: ApplicationStatus!
    appliedAt: String!
    jobUrl: String
    notes: String
    events: [ApplicationEvent!]!
  }

  input CreateApplicationInput {
    company: String!
    role: String!
    appliedAt: String
    jobUrl: String
    notes: String
  }

  input ApplicationEventInput {
    date: String!
    description: String!
  }

  type Query {
    applications(status: ApplicationStatus): [Application!]!
    application(id: ID!): Application
  }

  type Mutation {
    createApplication(input: CreateApplicationInput!): Application!
    updateApplicationStatus(id: ID!, status: ApplicationStatus!): Application!
    addEvent(id: ID!, event: ApplicationEventInput!): Application!
    deleteApplication(id: ID!): Boolean!
  }
`;
