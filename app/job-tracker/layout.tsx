import JobTrackerApolloProvider from "./ApolloProvider";

export default function JobTrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <JobTrackerApolloProvider>{children}</JobTrackerApolloProvider>;
}
