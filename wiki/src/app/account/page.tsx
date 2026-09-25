import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";
import AccountForm from "./account-form";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>我的账号</h1>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 24px" }}>
        {user.username}
        {user.nickname ? `（昵称：${user.nickname}）` : ""} · {user.name} ·{" "}
        {ROLE_LABELS[user.role]}
      </p>
      <AccountForm
        username={user.username}
        nickname={user.nickname ?? ""}
        realname={user.realname}
        idcard={user.idcard}
        phone={user.phone}
        mustChangePassword={user.must_change_password}
      />
    </main>
  );
}
