import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Landmark,
  PiggyBank,
  Plus,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { rupiah } from "../lib/format";
import {
  createPersonalFinanceCategory,
  deletePersonalFinanceBudget,
  deletePersonalFinanceTransaction,
  deletePersonalSavingsGoal,
  deletePersonalWishlistItem,
  loadPersonalFinanceSnapshot,
  purchasePersonalWishlistItem,
  savePersonalFinanceBudget,
  savePersonalFinanceTransaction,
  savePersonalSavingsGoal,
  savePersonalWishlistItem,
  type PersonalTransactionInput,
} from "../services/personalFinance";
import type {
  PersonalFinanceCategory,
  PersonalFinanceKind,
  PersonalFinanceSnapshot,
  PersonalFinanceTransaction,
  PersonalSavingsGoal,
  PersonalWishlistItem,
  PersonalWishlistPriority,
  ProjectPayment,
} from "../types";
import { Modal, ProgressBar } from "../components/ui";

type PersonalTab =
  | "overview"
  | "transactions"
  | "budgets"
  | "savings"
  | "wishlist"
  | "family";

const emptySnapshot: PersonalFinanceSnapshot = {
  categories: [],
  transactions: [],
  budgets: [],
  savingsGoals: [],
  wishlist: [],
};
const tabItems: Array<{ id: PersonalTab; label: string }> = [
  { id: "overview", label: "Ringkasan" },
  { id: "transactions", label: "Transaksi" },
  { id: "budgets", label: "Budget bulanan" },
  { id: "savings", label: "Target tabungan" },
  { id: "wishlist", label: "Wishlist" },
  { id: "family", label: "Keluarga" },
];
const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
});
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  return monthFormatter.format(new Date(`${value}-01T12:00:00`));
}

function progress(value: number, target: number) {
  return target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
}

function TransactionModal({
  categories,
  initial,
  defaultScope,
  onClose,
  onSave,
}: {
  categories: PersonalFinanceCategory[];
  initial?: PersonalFinanceTransaction;
  defaultScope?: "Personal" | "Family";
  onClose: () => void;
  onSave: (input: PersonalTransactionInput) => Promise<void>;
}) {
  const [kind, setKind] = useState<PersonalFinanceKind>(
    initial?.kind ?? "Expense",
  );
  const validCategories = categories.filter(
    (category) => category.kind === kind,
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [amount, setAmount] = useState(
    initial?.amount ? String(initial.amount) : "",
  );
  const [occurredOn, setOccurredOn] = useState(
    initial?.occurredOn ?? new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] = useState(
    initial?.paymentMethod ?? "Transfer bank",
  );
  const [scope, setScope] = useState<"Personal" | "Family">(
    initial?.scope ?? defaultScope ?? "Personal",
  );
  const [familyMember, setFamilyMember] = useState(initial?.familyMember ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isRecurring, setIsRecurring] = useState(initial?.isRecurring ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!validCategories.some((category) => category.id === categoryId))
      setCategoryId(validCategories[0]?.id ?? "");
  }, [categoryId, validCategories]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount.replace(/[^0-9]/g, ""));
    if (title.trim().length < 2 || numericAmount <= 0) {
      setError("Nama transaksi dan nominal wajib diisi.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await onSave({
        id: initial?.id,
        categoryId,
        title,
        kind,
        amount: numericAmount,
        occurredOn,
        paymentMethod,
        scope,
        familyMember,
        notes,
        isRecurring,
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Transaksi tidak dapat disimpan.",
      );
      setSaving(false);
    }
  };
  return (
    <Modal
      title={initial ? "Edit transaksi" : "Catat transaksi"}
      onClose={onClose}
    >
      <form className="project-form personal-money-form" onSubmit={submit}>
        <div className="personal-kind-switch">
          <button
            type="button"
            className={kind === "Income" ? "active income" : ""}
            onClick={() => setKind("Income")}
          >
            <ArrowDownRight size={16} /> Pemasukan
          </button>
          <button
            type="button"
            className={kind === "Expense" ? "active expense" : ""}
            onClick={() => setKind("Expense")}
          >
            <ArrowUpRight size={16} /> Pengeluaran
          </button>
        </div>
        <div className="form-grid">
          <label className="form-field form-field-full">
            <span>Nama transaksi</span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Contoh: Belanja bulanan"
            />
          </label>
          <label className="form-field">
            <span>Kategori</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {validCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Nominal</span>
            <div className="currency-input">
              <span>Rp</span>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="0"
              />
            </div>
          </label>
          <label className="form-field">
            <span>Tanggal</span>
            <input
              type="date"
              value={occurredOn}
              onChange={(event) => setOccurredOn(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Metode</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option>Transfer bank</option>
              <option>Tunai</option>
              <option>E-wallet</option>
              <option>Kartu</option>
              <option>Lainnya</option>
            </select>
          </label>
          <label className="form-field">
            <span>Penggunaan</span>
            <select
              value={scope}
              onChange={(event) =>
                setScope(event.target.value as "Personal" | "Family")
              }
            >
              <option value="Personal">Pribadi</option>
              <option value="Family">Keluarga</option>
            </select>
          </label>
          {scope === "Family" && (
            <label className="form-field">
              <span>Anggota keluarga</span>
              <input
                value={familyMember}
                onChange={(event) => setFamilyMember(event.target.value)}
                placeholder="Contoh: Rumah tangga / Anak"
              />
            </label>
          )}
          <label className="form-field form-field-full">
            <span>Catatan</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Keterangan tambahan…"
            />
          </label>
          <label className="personal-checkbox form-field-full">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(event) => setIsRecurring(event.target.checked)}
            />{" "}
            Tandai sebagai transaksi rutin
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Batal
          </button>
          <button className="primary-button" disabled={saving}>
            <Check size={17} /> {saving ? "Menyimpan…" : "Simpan transaksi"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BudgetModal({
  categories,
  month,
  onClose,
  onSave,
  onAddCategory,
}: {
  categories: PersonalFinanceCategory[];
  month: string;
  onClose: () => void;
  onSave: (input: {
    categoryId: string;
    month: string;
    kind: PersonalFinanceKind;
    plannedAmount: number;
  }) => Promise<void>;
  onAddCategory: (
    name: string,
    kind: PersonalFinanceKind,
  ) => Promise<PersonalFinanceCategory>;
}) {
  const [kind, setKind] = useState<PersonalFinanceKind>("Expense");
  const filtered = categories.filter((category) => category.kind === kind);
  const [categoryId, setCategoryId] = useState(filtered[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!filtered.some((item) => item.id === categoryId))
      setCategoryId(filtered[0]?.id ?? "");
  }, [categoryId, filtered]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    let selected = categoryId;
    setSaving(true);
    try {
      if (newCategory.trim())
        selected = (await onAddCategory(newCategory.trim(), kind)).id;
      await onSave({
        categoryId: selected,
        month,
        kind,
        plannedAmount: Number(amount.replace(/[^0-9]/g, "")),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Atur budget bulanan" onClose={onClose}>
      <form className="project-form personal-money-form" onSubmit={submit}>
        <div className="personal-kind-switch">
          <button
            type="button"
            className={kind === "Income" ? "active income" : ""}
            onClick={() => setKind("Income")}
          >
            Target pemasukan
          </button>
          <button
            type="button"
            className={kind === "Expense" ? "active expense" : ""}
            onClick={() => setKind("Expense")}
          >
            Batas pengeluaran
          </button>
        </div>
        <div className="form-grid">
          <label className="form-field form-field-full">
            <span>Bulan</span>
            <input value={monthLabel(month)} disabled />
          </label>
          <label className="form-field form-field-full">
            <span>Kategori</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Pilih kategori</option>
              {filtered.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field form-field-full">
            <span>Atau buat kategori baru</span>
            <input
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="Nama kategori baru (opsional)"
            />
          </label>
          <label className="form-field form-field-full">
            <span>Nominal rencana</span>
            <div className="currency-input">
              <span>Rp</span>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="0"
              />
            </div>
          </label>
        </div>
        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Batal
          </button>
          <button
            className="primary-button"
            disabled={
              saving || (!categoryId && !newCategory.trim()) || !Number(amount)
            }
          >
            <Check size={17} /> Simpan budget
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SavingsModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: PersonalSavingsGoal;
  onClose: () => void;
  onSave: (
    input: Omit<PersonalSavingsGoal, "id"> & { id?: string },
  ) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(
    initial?.targetAmount ? String(initial.targetAmount) : "",
  );
  const [current, setCurrent] = useState(
    initial?.currentAmount ? String(initial.currentAmount) : "0",
  );
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [color, setColor] = useState(initial?.color ?? "#2f6fdf");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        name,
        targetAmount: Number(target.replace(/[^0-9]/g, "")),
        currentAmount: Number(current.replace(/[^0-9]/g, "")),
        targetDate: targetDate || undefined,
        color,
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={initial ? "Update target tabungan" : "Buat target tabungan"}
      onClose={onClose}
    >
      <form className="project-form personal-money-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="form-field form-field-full">
            <span>Nama target</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Dana darurat keluarga"
            />
          </label>
          <label className="form-field">
            <span>Target nominal</span>
            <input
              inputMode="numeric"
              value={target}
              onChange={(event) =>
                setTarget(event.target.value.replace(/[^0-9]/g, ""))
              }
            />
          </label>
          <label className="form-field">
            <span>Sudah terkumpul</span>
            <input
              inputMode="numeric"
              value={current}
              onChange={(event) =>
                setCurrent(event.target.value.replace(/[^0-9]/g, ""))
              }
            />
          </label>
          <label className="form-field">
            <span>Target tanggal</span>
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Warna</span>
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
          <label className="form-field form-field-full">
            <span>Catatan</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>
        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Batal
          </button>
          <button
            className="primary-button"
            disabled={saving || name.trim().length < 2 || !Number(target)}
          >
            <PiggyBank size={17} /> Simpan target
          </button>
        </div>
      </form>
    </Modal>
  );
}

function WishlistModal({
  categories,
  initial,
  onClose,
  onSave,
}: {
  categories: PersonalFinanceCategory[];
  initial?: PersonalWishlistItem;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    categoryId?: string;
    name: string;
    estimatedAmount: number;
    priority: PersonalWishlistPriority;
    targetDate?: string;
    notes: string;
  }) => Promise<void>;
}) {
  const expenseCategories = categories.filter(
    (category) => category.kind === "Expense",
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(
    initial?.estimatedAmount ? String(initial.estimatedAmount) : "",
  );
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? expenseCategories[0]?.id ?? "",
  );
  const [priority, setPriority] = useState<PersonalWishlistPriority>(
    initial?.priority ?? "Medium",
  );
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        categoryId,
        name,
        estimatedAmount: Number(amount.replace(/[^0-9]/g, "")),
        priority,
        targetDate: targetDate || undefined,
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={initial ? "Edit wishlist" : "Tambah wishlist"}
      onClose={onClose}
    >
      <form className="project-form personal-money-form" onSubmit={submit}>
        <div className="form-intro">
          <span className="form-intro-icon">
            <ShoppingBag size={18} />
          </span>
          <p>
            Simpan barang, layanan, tagihan, atau kebutuhan yang ingin dibeli
            pada waktu mendatang.
          </p>
        </div>
        <div className="form-grid">
          <label className="form-field form-field-full">
            <span>Barang atau kebutuhan</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Laptop kerja baru"
            />
          </label>
          <label className="form-field">
            <span>Estimasi harga</span>
            <div className="currency-input">
              <span>Rp</span>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="0"
              />
            </div>
          </label>
          <label className="form-field">
            <span>Kategori transaksi</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Tanpa kategori</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Prioritas</span>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as PersonalWishlistPriority)
              }
            >
              <option value="High">Tinggi</option>
              <option value="Medium">Sedang</option>
              <option value="Low">Rendah</option>
            </select>
          </label>
          <label className="form-field">
            <span>Target beli / bayar</span>
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </label>
          <label className="form-field form-field-full">
            <span>Catatan</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Alasan membeli, toko, spesifikasi, atau catatan lainnya…"
            />
          </label>
        </div>
        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Batal
          </button>
          <button
            className="primary-button"
            disabled={saving || name.trim().length < 2 || !Number(amount)}
          >
            <ShoppingBag size={17} /> Simpan wishlist
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PurchaseWishlistModal({
  item,
  onClose,
  onPurchase,
}: {
  item: PersonalWishlistItem;
  onClose: () => void;
  onPurchase: (input: {
    itemId: string;
    amount: number;
    purchasedOn: string;
    paymentMethod: string;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(item.estimatedAmount));
  const [purchasedOn, setPurchasedOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] = useState("Transfer bank");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount.replace(/[^0-9]/g, ""));
    if (!numericAmount || !purchasedOn) {
      setError("Nominal aktual dan tanggal pembelian wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      await onPurchase({
        itemId: item.id,
        amount: numericAmount,
        purchasedOn,
        paymentMethod,
      });
      onClose();
    } catch (purchaseError) {
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : "Pembelian tidak dapat dicatat.",
      );
      setSaving(false);
    }
  };
  return (
    <Modal title="Catat sebagai dibeli" onClose={onClose}>
      <form className="project-form personal-money-form" onSubmit={submit}>
        <div className="wishlist-purchase-summary">
          <span>
            <ShoppingCart size={19} />
          </span>
          <div>
            <small>Wishlist</small>
            <strong>{item.name}</strong>
            <p>Estimasi {rupiah(item.estimatedAmount)}</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="form-field form-field-full">
            <span>Nominal pembelian aktual</span>
            <div className="currency-input">
              <span>Rp</span>
              <input
                autoFocus
                inputMode="numeric"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value.replace(/[^0-9]/g, ""))
                }
              />
            </div>
          </label>
          <label className="form-field">
            <span>Tanggal dibeli / dibayar</span>
            <input
              type="date"
              value={purchasedOn}
              onChange={(event) => setPurchasedOn(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Metode pembayaran</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option>Transfer bank</option>
              <option>Tunai</option>
              <option>E-wallet</option>
              <option>Kartu</option>
              <option>Lainnya</option>
            </select>
          </label>
        </div>
        <p className="wishlist-purchase-note">
          Setelah disimpan, nominal ini otomatis masuk sebagai transaksi
          pengeluaran pada tanggal yang dipilih.
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Batal
          </button>
          <button className="primary-button" disabled={saving}>
            <Check size={17} /> {saving ? "Mencatat…" : "Tandai dibeli"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PersonalFinancePage({
  workspaceId,
  businessPayments,
  onToast,
}: {
  workspaceId: string | null;
  businessPayments: ProjectPayment[];
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<PersonalTab>("overview");
  const [month, setMonth] = useState(currentMonth);
  const [snapshot, setSnapshot] =
    useState<PersonalFinanceSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured));
  const [error, setError] = useState("");
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<
    PersonalFinanceTransaction | undefined
  >();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<
    PersonalSavingsGoal | undefined
  >();
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [editingWishlist, setEditingWishlist] = useState<
    PersonalWishlistItem | undefined
  >();
  const [purchaseWishlist, setPurchaseWishlist] = useState<
    PersonalWishlistItem | undefined
  >();

  const refresh = useCallback(
    async (silent = false) => {
      if (!workspaceId || !isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        setSnapshot(await loadPersonalFinanceSnapshot(workspaceId));
        setError("");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Data keuangan pribadi tidak dapat dimuat.",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!workspaceId || !supabase) return;
    const channel = supabase
      .channel(`personal-finance-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "personal_finance_transactions",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void refresh(true);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "personal_finance_budgets",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void refresh(true);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "personal_savings_goals",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void refresh(true);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "personal_finance_wishlist",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void refresh(true);
        },
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [refresh, workspaceId]);

  const businessTransactions = useMemo<PersonalFinanceTransaction[]>(
    () =>
      businessPayments.map((payment) => ({
        id: `business-${payment.id}`,
        title: `${payment.projectName} · ${payment.client}`,
        kind: "Income",
        amount: payment.amount,
        occurredOn: payment.paidAt.slice(0, 10),
        paymentMethod: payment.method || "Pembayaran proyek",
        notes: payment.notes || "",
        scope: "Personal",
        familyMember: "",
        isRecurring: false,
        source: "Business",
        sourceId: payment.id,
        categoryId: snapshot.categories.find(
          (category) => category.name === "Pemasukan bisnis",
        )?.id,
      })),
    [businessPayments, snapshot.categories],
  );
  const allTransactions = useMemo(
    () =>
      [...snapshot.transactions, ...businessTransactions].sort((left, right) =>
        right.occurredOn.localeCompare(left.occurredOn),
      ),
    [businessTransactions, snapshot.transactions],
  );
  const monthTransactions = allTransactions.filter((transaction) =>
    transaction.occurredOn.startsWith(month),
  );
  const income = monthTransactions
    .filter((item) => item.kind === "Income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = monthTransactions
    .filter((item) => item.kind === "Expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const net = income - expense;
  const monthBudgets = snapshot.budgets.filter(
    (budget) => budget.month === month,
  );
  const plannedIncome = monthBudgets
    .filter((item) => item.kind === "Income")
    .reduce((sum, item) => sum + item.plannedAmount, 0);
  const plannedExpense = monthBudgets
    .filter((item) => item.kind === "Expense")
    .reduce((sum, item) => sum + item.plannedAmount, 0);
  const expenseBreakdown = snapshot.categories
    .filter((category) => category.kind === "Expense")
    .map((category) => ({
      category,
      amount: monthTransactions
        .filter(
          (item) => item.kind === "Expense" && item.categoryId === category.id,
        )
        .reduce((sum, item) => sum + item.amount, 0),
    }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const saveTransaction = async (input: PersonalTransactionInput) => {
    if (!workspaceId) return;
    await savePersonalFinanceTransaction(workspaceId, input);
    await refresh(true);
    onToast("Transaksi keuangan disimpan.");
  };
  const removeTransaction = async (transaction: PersonalFinanceTransaction) => {
    if (
      !workspaceId ||
      transaction.source === "Business" ||
      !window.confirm(`Hapus transaksi “${transaction.title}”?`)
    )
      return;
    await deletePersonalFinanceTransaction(workspaceId, transaction.id);
    await refresh(true);
    onToast("Transaksi dihapus.");
  };
  const addCategory = async (name: string, kind: PersonalFinanceKind) => {
    if (!workspaceId) throw new Error("Workspace belum siap.");
    const category = await createPersonalFinanceCategory(workspaceId, {
      name,
      kind,
      color: kind === "Income" ? "#48aa8b" : "#ed9a62",
    });
    setSnapshot((current) => ({
      ...current,
      categories: [...current.categories, category],
    }));
    return category;
  };
  const saveBudget = async (input: {
    categoryId: string;
    month: string;
    kind: PersonalFinanceKind;
    plannedAmount: number;
  }) => {
    if (!workspaceId) return;
    await savePersonalFinanceBudget(workspaceId, input);
    await refresh(true);
    onToast("Budget bulanan disimpan.");
  };
  const saveGoal = async (
    input: Omit<PersonalSavingsGoal, "id"> & { id?: string },
  ) => {
    if (!workspaceId) return;
    await savePersonalSavingsGoal(workspaceId, input);
    await refresh(true);
    onToast("Target tabungan disimpan.");
  };
  const saveWishlist = async (input: {
    id?: string;
    categoryId?: string;
    name: string;
    estimatedAmount: number;
    priority: PersonalWishlistPriority;
    targetDate?: string;
    notes: string;
  }) => {
    if (!workspaceId) return;
    await savePersonalWishlistItem(workspaceId, input);
    await refresh(true);
    onToast("Wishlist disimpan.");
  };
  const markWishlistPurchased = async (input: {
    itemId: string;
    amount: number;
    purchasedOn: string;
    paymentMethod: string;
  }) => {
    if (!workspaceId) return;
    await purchasePersonalWishlistItem(workspaceId, input);
    await refresh(true);
    onToast("Pembelian tercatat sebagai pengeluaran.");
  };

  const transactionList = (items: PersonalFinanceTransaction[]) => (
    <div className="personal-transaction-list">
      {items.map((transaction) => {
        const category = snapshot.categories.find(
          (item) => item.id === transaction.categoryId,
        );
        return (
          <article
            key={transaction.id}
            className="personal-transaction-row"
            onClick={() => {
              if (transaction.source === "Manual") {
                setEditingTransaction(transaction);
                setTransactionOpen(true);
              }
            }}
          >
            <span
              className={`personal-transaction-icon ${transaction.kind.toLowerCase()}`}
            >
              {transaction.kind === "Income" ? (
                <ArrowDownRight size={17} />
              ) : (
                <ArrowUpRight size={17} />
              )}
            </span>
            <span className="personal-transaction-copy">
              <strong>{transaction.title}</strong>
              <small>
                {category?.name ??
                  (transaction.source === "Business"
                    ? "Pemasukan bisnis"
                    : "Tanpa kategori")}{" "}
                ·{" "}
                {dateFormatter.format(
                  new Date(`${transaction.occurredOn}T12:00:00`),
                )}
                {transaction.scope === "Family"
                  ? ` · ${transaction.familyMember || "Keluarga"}`
                  : ""}
              </small>
            </span>
            {transaction.source === "Business" && (
              <em className="personal-sync-chip">
                <RefreshCw size={11} /> Bisnis
              </em>
            )}
            <strong
              className={
                transaction.kind === "Income" ? "money-income" : "money-expense"
              }
            >
              {transaction.kind === "Income" ? "+" : "-"}
              {rupiah(transaction.amount)}
            </strong>
            {transaction.source === "Manual" && (
              <button
                className="personal-delete-button"
                onClick={(event) => {
                  event.stopPropagation();
                  void removeTransaction(transaction);
                }}
                aria-label="Hapus transaksi"
              >
                <Trash2 size={15} />
              </button>
            )}
          </article>
        );
      })}
      {!items.length && (
        <div className="personal-empty">
          <WalletCards size={24} />
          <strong>Belum ada transaksi</strong>
          <p>
            Catat pemasukan atau pengeluaran untuk mulai melihat pola keuangan.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="module-page personal-finance-page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Personal money</p>
          <h1>Keuangan pribadi</h1>
          <p>
            Kelola cashflow pribadi, budget keluarga, dan target tabungan dalam
            satu ruang yang terpisah dari Finance bisnis.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            setEditingTransaction(undefined);
            setTransactionOpen(true);
          }}
        >
          <Plus size={18} /> Catat transaksi
        </button>
      </section>
      <div className="personal-finance-tabs">
        {tabItems.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="personal-month-nav">
        <button onClick={() => setMonth((value) => shiftMonth(value, -1))}>
          <ChevronLeft size={17} />
        </button>
        <strong>{monthLabel(month)}</strong>
        <button onClick={() => setMonth((value) => shiftMonth(value, 1))}>
          <ChevronRight size={17} />
        </button>
      </div>
      {error && (
        <div className="personal-finance-setup">
          <Landmark size={20} />
          <div>
            <strong>Database keuangan pribadi belum siap</strong>
            <p>{error}</p>
          </div>
        </div>
      )}
      {loading ? (
        <div className="personal-loading">Menyiapkan data keuangan…</div>
      ) : tab === "overview" ? (
        <>
          <section className="personal-money-stats">
            <article className="income">
              <span>Pemasukan bulan ini</span>
              <strong>{rupiah(income)}</strong>
              <p>
                {plannedIncome
                  ? `${progress(income, plannedIncome)}% dari target`
                  : "Termasuk pembayaran bisnis"}
              </p>
            </article>
            <article className="expense">
              <span>Pengeluaran bulan ini</span>
              <strong>{rupiah(expense)}</strong>
              <p>
                {plannedExpense
                  ? `${progress(expense, plannedExpense)}% dari budget`
                  : "Budget belum ditetapkan"}
              </p>
            </article>
            <article
              className={net >= 0 ? "balance positive" : "balance negative"}
            >
              <span>Saldo bersih</span>
              <strong>{rupiah(net)}</strong>
              <p>
                {income
                  ? `${Math.round((net / income) * 100)}% saving rate`
                  : "Belum ada pemasukan"}
              </p>
            </article>
            <article>
              <span>Total tabungan tercatat</span>
              <strong>
                {rupiah(
                  snapshot.savingsGoals.reduce(
                    (sum, goal) => sum + goal.currentAmount,
                    0,
                  ),
                )}
              </strong>
              <p>{snapshot.savingsGoals.length} target aktif</p>
            </article>
          </section>
          <section className="personal-overview-grid">
            <article className="card personal-spending-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Spending breakdown</p>
                  <h2>Pengeluaran per kategori</h2>
                </div>
              </div>
              <div className="personal-category-bars">
                {expenseBreakdown.map(({ category, amount }) => (
                  <div key={category.id}>
                    <span>
                      <i style={{ background: category.color }} />
                      {category.name}
                      <b>{rupiah(amount)}</b>
                    </span>
                    <ProgressBar
                      value={expense ? Math.round((amount / expense) * 100) : 0}
                      compact
                    />
                  </div>
                ))}
                {!expenseBreakdown.length && (
                  <p className="muted-copy">
                    Belum ada pengeluaran pada bulan ini.
                  </p>
                )}
              </div>
            </article>
            <article className="card personal-budget-health">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Budget health</p>
                  <h2>Rencana bulan ini</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setTab("budgets")}
                >
                  Kelola
                </button>
              </div>
              <div className="personal-budget-rings">
                <div>
                  <strong>{progress(income, plannedIncome)}%</strong>
                  <span>Target pemasukan</span>
                </div>
                <div
                  className={
                    expense > plannedExpense && plannedExpense ? "danger" : ""
                  }
                >
                  <strong>{progress(expense, plannedExpense)}%</strong>
                  <span>Budget terpakai</span>
                </div>
              </div>
              <p>
                {plannedIncome || plannedExpense
                  ? `${rupiah(plannedIncome)} target masuk · ${rupiah(plannedExpense)} batas keluar`
                  : "Tambahkan target pemasukan dan batas pengeluaran agar kondisi bulanan mudah dipantau."}
              </p>
            </article>
          </section>
          <section className="card personal-recent-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">Aktivitas terbaru</p>
                <h2>Transaksi bulan ini</h2>
              </div>
              <button
                className="text-button"
                onClick={() => setTab("transactions")}
              >
                Lihat semua
              </button>
            </div>
            {transactionList(monthTransactions.slice(0, 6))}
          </section>
        </>
      ) : tab === "transactions" ? (
        <section className="card personal-list-page">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Cashflow ledger</p>
              <h2>Semua transaksi</h2>
            </div>
            <span>{monthTransactions.length} transaksi</span>
          </div>
          {transactionList(monthTransactions)}
        </section>
      ) : tab === "budgets" ? (
        <section className="personal-budget-page">
          <div className="personal-section-action">
            <div>
              <h2>Budget {monthLabel(month)}</h2>
              <p>Atur target pemasukan dan batas pengeluaran per kategori.</p>
            </div>
            <button
              className="primary-button"
              onClick={() => setBudgetOpen(true)}
            >
              <Plus size={16} /> Tambah budget
            </button>
          </div>
          <div className="personal-budget-grid">
            {monthBudgets.map((budget) => {
              const category = snapshot.categories.find(
                (item) => item.id === budget.categoryId,
              );
              const actual = monthTransactions
                .filter(
                  (item) =>
                    item.kind === budget.kind &&
                    item.categoryId === budget.categoryId,
                )
                .reduce((sum, item) => sum + item.amount, 0);
              const used = progress(actual, budget.plannedAmount);
              return (
                <article className="card personal-budget-card" key={budget.id}>
                  <header>
                    <span style={{ background: category?.color }}>
                      <CircleDollarSign size={17} />
                    </span>
                    <button
                      onClick={() => {
                        if (workspaceId)
                          void deletePersonalFinanceBudget(
                            workspaceId,
                            budget.id,
                          ).then(() => refresh(true));
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </header>
                  <strong>{category?.name ?? "Kategori"}</strong>
                  <p>
                    {budget.kind === "Income"
                      ? "Target pemasukan"
                      : "Batas pengeluaran"}
                  </p>
                  <h3>{rupiah(budget.plannedAmount)}</h3>
                  <ProgressBar value={used} compact />
                  <small>
                    {rupiah(actual)} aktual · {used}%
                  </small>
                </article>
              );
            })}
            {!monthBudgets.length && (
              <div className="personal-empty card">
                <Landmark size={25} />
                <strong>Budget belum dibuat</strong>
                <p>
                  Mulai dari target pemasukan, kebutuhan rumah, tagihan, dan
                  tabungan.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : tab === "savings" ? (
        <section className="personal-savings-page">
          <div className="personal-section-action">
            <div>
              <h2>Target tabungan</h2>
              <p>
                Pantau dana darurat, pendidikan, liburan, atau tujuan keluarga.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                setEditingGoal(undefined);
                setGoalOpen(true);
              }}
            >
              <Plus size={16} /> Buat target
            </button>
          </div>
          <div className="personal-goal-grid">
            {snapshot.savingsGoals.map((goal) => (
              <article
                className="card personal-goal-card"
                key={goal.id}
                onClick={() => {
                  setEditingGoal(goal);
                  setGoalOpen(true);
                }}
              >
                <header>
                  <span
                    style={{ color: goal.color, background: `${goal.color}18` }}
                  >
                    <PiggyBank size={20} />
                  </span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      if (
                        workspaceId &&
                        window.confirm(`Hapus target “${goal.name}”?`)
                      )
                        void deletePersonalSavingsGoal(
                          workspaceId,
                          goal.id,
                        ).then(() => refresh(true));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </header>
                <h3>{goal.name}</h3>
                <strong>
                  {rupiah(goal.currentAmount)}{" "}
                  <small>dari {rupiah(goal.targetAmount)}</small>
                </strong>
                <ProgressBar
                  value={progress(goal.currentAmount, goal.targetAmount)}
                  compact
                />
                <footer>
                  <span>
                    {progress(goal.currentAmount, goal.targetAmount)}% tercapai
                  </span>
                  <span>
                    {goal.targetDate
                      ? dateFormatter.format(
                          new Date(`${goal.targetDate}T12:00:00`),
                        )
                      : "Tanpa deadline"}
                  </span>
                </footer>
              </article>
            ))}
            {!snapshot.savingsGoals.length && (
              <div className="personal-empty card">
                <PiggyBank size={25} />
                <strong>Belum ada target tabungan</strong>
                <p>
                  Buat tujuan pertama dan perbarui nominalnya setiap kali
                  menabung.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : tab === "wishlist" ? (
        <section className="personal-wishlist-page">
          <div className="personal-section-action">
            <div>
              <h2>Wishlist pembelian</h2>
              <p>
                Rencanakan barang, layanan, atau tagihan sebelum menjadi
                pengeluaran aktual.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                setEditingWishlist(undefined);
                setWishlistOpen(true);
              }}
            >
              <Plus size={16} /> Tambah wishlist
            </button>
          </div>
          <section className="personal-money-stats compact">
            <article>
              <span>Rencana aktif</span>
              <strong>
                {snapshot.wishlist.filter((item) => item.status === "Planned").length}
              </strong>
              <p>Item belum dibeli</p>
            </article>
            <article>
              <span>Total estimasi</span>
              <strong>
                {rupiah(
                  snapshot.wishlist
                    .filter((item) => item.status === "Planned")
                    .reduce((sum, item) => sum + item.estimatedAmount, 0),
                )}
              </strong>
              <p>Kebutuhan yang direncanakan</p>
            </article>
            <article>
              <span>Dibeli bulan ini</span>
              <strong>
                {rupiah(
                  snapshot.wishlist
                    .filter(
                      (item) =>
                        item.status === "Purchased" &&
                        item.purchasedAt?.startsWith(month),
                    )
                    .reduce((sum, item) => sum + (item.actualAmount ?? 0), 0),
                )}
              </strong>
              <p>Otomatis masuk transaksi</p>
            </article>
          </section>
          <div className="personal-wishlist-grid">
            {snapshot.wishlist.map((item) => {
              const category = snapshot.categories.find(
                (entry) => entry.id === item.categoryId,
              );
              return (
                <article
                  className={`card personal-wishlist-card ${item.status === "Purchased" ? "purchased" : ""}`}
                  key={item.id}
                >
                  <header>
                    <span
                      className={`wishlist-priority ${item.priority.toLowerCase()}`}
                    >
                      {item.priority === "High"
                        ? "Prioritas tinggi"
                        : item.priority === "Low"
                          ? "Prioritas rendah"
                          : "Prioritas sedang"}
                    </span>
                    <button
                      onClick={() => {
                        if (
                          workspaceId &&
                          window.confirm(`Hapus “${item.name}” dari wishlist?`)
                        )
                          void deletePersonalWishlistItem(
                            workspaceId,
                            item.id,
                          ).then(() => refresh(true));
                      }}
                      aria-label={`Hapus ${item.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </header>
                  <div className="wishlist-item-main">
                    <span>
                      <ShoppingBag size={20} />
                    </span>
                    <div>
                      <h3>{item.name}</h3>
                      <p>
                        {category?.name ?? "Tanpa kategori"}
                        {item.targetDate
                          ? ` · Target ${dateFormatter.format(new Date(`${item.targetDate}T12:00:00`))}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <strong>
                    {rupiah(
                      item.status === "Purchased"
                        ? item.actualAmount ?? item.estimatedAmount
                        : item.estimatedAmount,
                    )}
                  </strong>
                  {item.notes && <p className="wishlist-notes">{item.notes}</p>}
                  <footer>
                    {item.status === "Purchased" ? (
                      <span className="wishlist-purchased">
                        <Check size={14} /> Dibeli{" "}
                        {item.purchasedAt
                          ? dateFormatter.format(
                              new Date(`${item.purchasedAt}T12:00:00`),
                            )
                          : ""}{" "}
                        · Tercatat di transaksi
                      </span>
                    ) : (
                      <>
                        <button
                          className="soft-button"
                          onClick={() => {
                            setEditingWishlist(item);
                            setWishlistOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="primary-button"
                          onClick={() => setPurchaseWishlist(item)}
                        >
                          <ShoppingCart size={15} /> Tandai dibeli
                        </button>
                      </>
                    )}
                  </footer>
                </article>
              );
            })}
            {!snapshot.wishlist.length && (
              <div className="personal-empty card">
                <ShoppingBag size={26} />
                <strong>Wishlist masih kosong</strong>
                <p>
                  Tambahkan barang atau pembayaran yang sedang Anda rencanakan.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="personal-family-page">
          <div className="personal-family-hero">
            <div>
              <span>
                <UsersRound size={20} />
              </span>
              <div>
                <p className="eyebrow">Family finance</p>
                <h2>Budget keluarga</h2>
                <p>
                  Catat kebutuhan rumah dan lihat pengeluaran setiap anggota
                  tanpa bercampur dengan transaksi pribadi.
                </p>
              </div>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                setEditingTransaction(undefined);
                setTransactionOpen(true);
              }}
            >
              <Plus size={16} /> Catat kebutuhan keluarga
            </button>
          </div>
          <section className="personal-money-stats compact">
            <article>
              <span>Pengeluaran keluarga</span>
              <strong>
                {rupiah(
                  monthTransactions
                    .filter(
                      (item) =>
                        item.kind === "Expense" && item.scope === "Family",
                    )
                    .reduce((sum, item) => sum + item.amount, 0),
                )}
              </strong>
              <p>{monthLabel(month)}</p>
            </article>
            <article>
              <span>Transaksi rutin</span>
              <strong>
                {
                  monthTransactions.filter(
                    (item) => item.scope === "Family" && item.isRecurring,
                  ).length
                }
              </strong>
              <p>Tagihan dan kebutuhan berulang</p>
            </article>
            <article>
              <span>Anggota tercatat</span>
              <strong>
                {
                  new Set(
                    monthTransactions
                      .filter((item) => item.scope === "Family")
                      .map((item) => item.familyMember)
                      .filter(Boolean),
                  ).size
                }
              </strong>
              <p>Dalam transaksi bulan ini</p>
            </article>
          </section>
          <section className="card personal-list-page">
            <div className="card-heading">
              <div>
                <p className="eyebrow">Kebutuhan keluarga</p>
                <h2>Riwayat bulan ini</h2>
              </div>
            </div>
            {transactionList(
              monthTransactions.filter((item) => item.scope === "Family"),
            )}
          </section>
        </section>
      )}
      {transactionOpen && (
        <TransactionModal
          categories={snapshot.categories}
          initial={editingTransaction}
          defaultScope={tab === "family" ? "Family" : "Personal"}
          onClose={() => {
            setTransactionOpen(false);
            setEditingTransaction(undefined);
          }}
          onSave={saveTransaction}
        />
      )}
      {budgetOpen && (
        <BudgetModal
          categories={snapshot.categories}
          month={month}
          onClose={() => setBudgetOpen(false)}
          onSave={saveBudget}
          onAddCategory={addCategory}
        />
      )}
      {goalOpen && (
        <SavingsModal
          initial={editingGoal}
          onClose={() => {
            setGoalOpen(false);
            setEditingGoal(undefined);
          }}
          onSave={saveGoal}
        />
      )}
      {wishlistOpen && (
        <WishlistModal
          categories={snapshot.categories}
          initial={editingWishlist}
          onClose={() => {
            setWishlistOpen(false);
            setEditingWishlist(undefined);
          }}
          onSave={saveWishlist}
        />
      )}
      {purchaseWishlist && (
        <PurchaseWishlistModal
          item={purchaseWishlist}
          onClose={() => setPurchaseWishlist(undefined)}
          onPurchase={markWishlistPurchased}
        />
      )}
    </div>
  );
}
