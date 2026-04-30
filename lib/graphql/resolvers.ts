import {
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../dynamodb";
import { v4 as uuidv4 } from "uuid";

type DynamoItem = Record<string, unknown>;

function normalizeApplication(item: DynamoItem) {
  return {
    ...item,
    events: (item.events as unknown[]) ?? [],
  };
}

export const resolvers = {
  Query: {
    applications: async (_: unknown, args: { status?: string }) => {
      if (args.status) {
        const result = await docClient.send(
          new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "#s = :status",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: { ":status": args.status },
          })
        );
        return (result.Items ?? []).map(normalizeApplication);
      }
      const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
      return (result.Items ?? []).map(normalizeApplication);
    },

    application: async (_: unknown, args: { id: string }) => {
      const result = await docClient.send(
        new GetCommand({ TableName: TABLE_NAME, Key: { id: args.id } })
      );
      return result.Item ? normalizeApplication(result.Item) : null;
    },
  },

  Mutation: {
    createApplication: async (
      _: unknown,
      args: { input: { company: string; role: string; appliedAt?: string; jobUrl?: string; notes?: string } }
    ) => {
      const today = new Date().toISOString().split("T")[0];
      const appliedAt = args.input.appliedAt ?? today;
      const item = {
        id: uuidv4(),
        company: args.input.company,
        role: args.input.role,
        status: "APPLIED",
        appliedAt,
        jobUrl: args.input.jobUrl ?? null,
        notes: args.input.notes ?? null,
        events: [{ date: appliedAt, description: "Applied" }],
      };
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      return normalizeApplication(item);
    },

    updateApplicationStatus: async (
      _: unknown,
      args: { id: string; status: string }
    ) => {
      const today = new Date().toISOString().split("T")[0];
      const label = args.status.replace(/_/g, " ");
      const result = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id: args.id },
          UpdateExpression: "SET #s = :status, events = list_append(events, :newEvent)",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":status": args.status,
            ":newEvent": [{ date: today, description: `Status updated to ${label}` }],
          },
          ReturnValues: "ALL_NEW",
        })
      );
      return normalizeApplication(result.Attributes as DynamoItem);
    },

    addEvent: async (
      _: unknown,
      args: { id: string; event: { date: string; description: string } }
    ) => {
      const result = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id: args.id },
          UpdateExpression: "SET events = list_append(events, :newEvent)",
          ExpressionAttributeValues: {
            ":newEvent": [{ date: args.event.date, description: args.event.description }],
          },
          ReturnValues: "ALL_NEW",
        })
      );
      return normalizeApplication(result.Attributes as DynamoItem);
    },

    deleteApplication: async (_: unknown, args: { id: string }) => {
      await docClient.send(
        new DeleteCommand({ TableName: TABLE_NAME, Key: { id: args.id } })
      );
      return true;
    },
  },
};
