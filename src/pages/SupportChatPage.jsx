import ChatPage from "./ChatPage";

export default function SupportChatPage() {
  return (
    <ChatPage
      conversationType="support"
      title="Support"
      placeholder="Type your message..."
      emptyText="Start a conversation with Hashmi Network Support."
    />
  );
}
