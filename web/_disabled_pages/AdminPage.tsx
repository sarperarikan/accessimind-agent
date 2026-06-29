import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { AdminUser, AuthMeResponse } from "@/lib/api";
import { UserPlus, Trash2, Shield, Users, Loader2, CheckCircle, Key, UserCheck, RefreshCw, X, ShieldAlert } from "lucide-react";

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthMeResponse | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New User Form State
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [creatingUser, setCreatingUser] = useState(false);

  // Reset Password Modal State
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    // Get current logged-in user
    api.getAuthMe()
      .then((user) => {
        setCurrentUser(user);
        setLoadingRole(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadingRole(false);
      });
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoadingUsers(true);
    setError(null);
    try {
      const resp = await api.adminListUsers();
      setUsers(resp.users);
    } catch (err: any) {
      console.error(err);
      setError("Kullanıcı listesi alınamadı. Lütfen yetkinizi kontrol edin.");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleToggleStatus(user: AdminUser) {
    if (user.username === currentUser?.user_id) {
      setError("Kendi hesabınızın durumunu değiştiremezsiniz.");
      return;
    }
    setError(null);
    setSuccess(null);
    const newStatus = user.is_active === 1 ? false : true;
    try {
      const resp = await api.adminUpdateUser(user.id, { is_active: newStatus });
      setSuccess(`"${user.username}" kullanıcısının durumu güncellendi.`);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: resp.user.is_active } : u));
    } catch (err: any) {
      console.error(err);
      setError("Kullanıcı durumu güncellenirken hata oluştu.");
    }
  }

  async function handleToggleRole(user: AdminUser) {
    if (user.username === currentUser?.user_id) {
      setError("Kendi rolünüzü değiştiremezsiniz.");
      return;
    }
    setError(null);
    setSuccess(null);
    const newRole = user.role === "admin" ? "user" : "admin";
    try {
      const resp = await api.adminUpdateUser(user.id, { role: newRole });
      setSuccess(`"${user.username}" kullanıcısının rolü "${newRole === "admin" ? "Yönetici" : "Kullanıcı"}" olarak güncellendi.`);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: resp.user.role } : u));
    } catch (err: any) {
      console.error(err);
      setError("Kullanıcı rolü güncellenirken hata oluştu.");
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    const username = newUsername.trim();
    const password = newPassword.trim();
    if (!username || !password) return;

    setCreatingUser(true);
    setError(null);
    setSuccess(null);

    try {
      await api.adminCreateUser({
        username,
        password_plain: password,
        role: newRole,
      });
      setSuccess(`Kullanıcı "${username}" başarıyla oluşturuldu.`);
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      setError("Kullanıcı oluşturulurken bir hata oluştu veya kullanıcı zaten mevcut.");
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    if (user.username === currentUser?.user_id) {
      setError("Kendinizi silemezsiniz.");
      return;
    }
    if (!window.confirm(`"${user.username}" kullanıcısını silmek istediğinize emin misiniz?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.adminDeleteUser(user.id);
      setSuccess(`Kullanıcı "${user.username}" başarıyla silindi.`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: any) {
      console.error(err);
      setError("Kullanıcı silinirken bir hata oluştu.");
    }
  }

  async function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resettingUser) return;
    const password = resetPasswordVal.trim();
    if (!password) {
      setError("Şifre boş olamaz.");
      return;
    }

    setIsResetting(true);
    setError(null);
    setSuccess(null);

    try {
      await api.adminUpdateUser(resettingUser.id, { password_plain: password });
      setSuccess(`"${resettingUser.username}" kullanıcısının şifresi başarıyla sıfırlandı.`);
      setResettingUser(null);
    } catch (err: any) {
      console.error(err);
      setError("Şifre sıfırlanırken hata oluştu.");
    } finally {
      setIsResetting(false);
    }
  }

  if (loadingRole) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="animate-spin h-8 w-8 text-teal-500" />
        <p className="text-sm">Yetki kontrol ediliyor...</p>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-destructive">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h3 className="text-lg font-semibold">Yetkisiz Erişim</h3>
        <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full">
      <header className="border-b border-border/60 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Shield className="text-teal-500 h-6 w-6" /> Kullanıcı Yönetimi
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            AccessiMind paneli yetkili kullanıcı hesaplarını yönetin.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loadingUsers}
          className="bg-background hover:bg-muted/10 border border-border rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 text-foreground"
        >
          {loadingUsers ? <Loader2 className="animate-spin h-4 w-4 text-teal-500" /> : <RefreshCw className="h-4 w-4" />}
          Yenile
        </button>
      </header>

      {/* Global Alerts */}
      {error && (
        <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg text-sm" role="alert">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm" role="alert">
          <CheckCircle size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create User Form Section */}
        <section className="bg-card/40 border border-border/60 rounded-xl p-5 h-fit flex flex-col gap-4">
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <UserPlus className="text-teal-500 h-5 w-5" /> Yeni Kullanıcı Ekle
          </h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground block">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Örn: sarper"
                className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground block">
                Şifre
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground block">
                Rol
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
                className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 text-foreground"
              >
                <option value="user">Kullanıcı (User)</option>
                <option value="admin">Yönetici (Admin)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={creatingUser || !newUsername.trim() || !newPassword.trim()}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white rounded-lg py-2 font-medium text-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingUser ? <Loader2 className="animate-spin h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              Kullanıcı Oluştur
            </button>
          </form>
        </section>

        {/* Users Table List Section */}
        <section className="lg:col-span-2 bg-card/40 border border-border/60 rounded-xl p-5 flex flex-col gap-4">
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Users className="text-teal-500 h-5 w-5" /> Kayıtlı Kullanıcılar
          </h3>
          
          {loadingUsers ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="animate-spin h-8 w-8 text-teal-500" />
              <p className="text-sm">Kullanıcılar yükleniyor...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Kayıtlı kullanıcı bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground text-xs font-semibold uppercase">
                    <th className="pb-3">Kullanıcı Adı</th>
                    <th className="pb-3">Rol</th>
                    <th className="pb-3 text-center">Durum</th>
                    <th className="pb-3 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-foreground">
                  {users.map((u) => {
                    const isSelf = u.username === currentUser?.user_id;
                    return (
                      <tr key={u.id} className="hover:bg-muted/10">
                        <td className="py-3.5 font-medium flex items-center gap-2">
                          <span>{u.username}</span>
                          {isSelf && (
                            <span className="bg-teal-500/10 text-teal-500 text-[10px] px-1.5 py-0.5 rounded border border-teal-500/20 font-normal">
                              Siz
                            </span>
                          )}
                        </td>
                        <td className="py-3.5">
                          <button
                            onClick={() => handleToggleRole(u)}
                            disabled={isSelf}
                            className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${
                              u.role === "admin"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            } disabled:opacity-80 disabled:cursor-not-allowed`}
                            title={isSelf ? "Kendi rolünüzü değiştiremezsiniz" : "Rolü değiştirmek için tıklayın"}
                          >
                            {u.role === "admin" ? "Yönetici (Admin)" : "Kullanıcı (User)"}
                          </button>
                        </td>
                        <td className="py-3.5 text-center">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={isSelf}
                            className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${
                              u.is_active === 1
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                            } disabled:opacity-80 disabled:cursor-not-allowed`}
                            title={isSelf ? "Kendi durumunuzu değiştiremezsiniz" : "Durumu değiştirmek için tıklayın"}
                          >
                            {u.is_active === 1 ? "Aktif" : "Devre Dışı"}
                          </button>
                        </td>
                        <td className="py-3.5 text-right space-x-2">
                          <button
                            onClick={() => {
                              setResettingUser(u);
                              setResetPasswordVal("");
                            }}
                            className="p-1.5 bg-background border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-teal-500 transition-all inline-flex items-center"
                            title="Şifreyi Sıfırla"
                          >
                            <Key size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={isSelf}
                            className="p-1.5 bg-background border border-border rounded-lg text-muted-foreground hover:text-destructive hover:border-destructive transition-all inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isSelf ? "Kendinizi silemezsiniz" : "Kullanıcıyı Sil"}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Password Reset Modal Overlay */}
      {resettingUser && (
        <div className="fixed inset-0 bg-background/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 relative shadow-lg">
            <button
              onClick={() => setResettingUser(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-medium text-foreground flex items-center gap-2 mb-2">
              <Key className="text-teal-500 h-5 w-5" /> Şifre Sıfırla
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              <strong className="text-foreground">{resettingUser.username}</strong> kullanıcısı için yeni bir şifre belirleyin.
            </p>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Yeni Şifre
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 text-foreground"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 bg-background border border-border hover:bg-muted/10 rounded-lg text-sm font-medium transition-colors text-foreground"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isResetting || !resetPasswordVal.trim()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  {isResetting ? <Loader2 className="animate-spin h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                  Şifreyi Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
