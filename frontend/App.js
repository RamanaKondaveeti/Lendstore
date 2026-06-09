import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://3.108.233.74/api';

const THEME = {
  primary: '#1B4332',    // Deep Forest Green
  secondary: '#081C15',  // Midnight Green
  accent: '#D4AF37',     // Muted Gold
  ink: '#1A1C1E',        // Deep Charcoal
  muted: '#717672',      // Sage Grey
  background: '#F9FAF9', // Ultra-clean Off-white
  surface: '#FFFFFF',    // Pure White
  soft: '#F0F2F0',       // Light Sage Tint
  success: '#2D6A4F',
  error: '#BC4749',
  warning: '#A47148',
  border: '#E8EBE8',
  shadow: 'rgba(0, 0, 0, 0.06)'
};

const AuthContext = createContext(null);

const currency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Today';
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthISO = () => new Date().toISOString().slice(0, 7);
const idOf = (item) => String(item?._id || item?.id || item?.userId || '');

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('token');
        const savedUser = await AsyncStorage.getItem('user');
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error('Unable to restore session', error);
      } finally {
        setLoading(false);
      }
    };
    loadAuth();
  }, []);

  const login = async (nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    await AsyncStorage.setItem('token', nextToken);
    await AsyncStorage.setItem('user', JSON.stringify(nextUser));
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    setSelectedRole(null);
    await AsyncStorage.multiRemove(['token', 'user']);
  };

  if (loading) {
    return <CenteredLoader />;
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      <SafeAreaProvider>
        {token ? <MainScreen /> : selectedRole ? <AuthScreen role={selectedRole} onBack={() => setSelectedRole(null)} /> : <RoleSelectionScreen onSelectRole={setSelectedRole} />}
      </SafeAreaProvider>
    </AuthContext.Provider>
  );
}

function CenteredLoader() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={THEME.primary} />
    </View>
  );
}

function RoleSelectionScreen({ onSelectRole }) {
  return (
    <View style={styles.authContainer}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.secondary} />
      <View style={styles.authPanel}>
        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="shield-home" size={42} color={THEME.accent} />
        </View>
        <Text style={styles.authTitle}>Nivaas</Text>
        <Text style={styles.authSubtitle}>Premier Hostel Management System</Text>

        <View style={styles.roleGrid}>
          <TouchableOpacity style={styles.roleCard} onPress={() => onSelectRole('user')}>
            <View style={[styles.roleIconCircle, { backgroundColor: THEME.soft }]}>
              <Ionicons name="person-outline" size={28} color={THEME.primary} />
            </View>
            <Text style={styles.roleText}>Resident</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.roleCard, styles.roleCardActive]} onPress={() => onSelectRole('admin')}>
            <View style={[styles.roleIconCircle, { backgroundColor: THEME.primary }]}>
              <Ionicons name="shield-checkmark-outline" size={28} color={THEME.accent} />
            </View>
            <Text style={[styles.roleText, { color: '#fff' }]}>Admin</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function AuthScreen({ role, onBack }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Missing details', 'Email and password are required.');
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      if (data.user?.role !== role) {
        Alert.alert('Role mismatch', `Logged in as ${data.user?.role || 'user'}. Please select the correct role.`);
      }
      await login(data.token, data.user);
    } catch (error) {
      Alert.alert('Login failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.authContainer}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.secondary} />
      <View style={styles.authPanel}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={THEME.muted} />
        </TouchableOpacity>

        <Text style={styles.authTitleSmall}>{role === 'admin' ? 'Administration' : 'Resident Portal'}</Text>
        <Text style={styles.authSubtitle}>Sign in to access your secure dashboard</Text>

        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Demo Account</Text>
          {role === 'admin' ? (
            <TouchableOpacity style={styles.demoButton} onPress={() => { setEmail('newadmin@hostel.local'); setPassword('NewAdmin@123'); }}>
              <Text style={styles.demoButtonText}>newadmin@hostel.local</Text>
              <Ionicons name="finger-print-outline" size={18} color={THEME.accent} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.demoButton} onPress={() => { setEmail('ramana@hostel.local'); setPassword('ramana@123'); }}>
              <Text style={styles.demoButtonText}>ramana@hostel.local</Text>
              <Ionicons name="finger-print-outline" size={18} color={THEME.accent} />
            </TouchableOpacity>
          )}
        </View>

        <LabeledInput label="Email Address" value={email} onChangeText={setEmail} placeholder="Enter your email" keyboardType="email-address" autoCapitalize="none" />
        <LabeledInput label="Secure Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry />

        <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Authorize Access</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function MainScreen() {
  const { token, user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState(user?.role === 'admin' ? 'admin' : 'home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(emptyData);

  useEffect(() => {
    setActiveTab(user?.role === 'admin' ? 'admin' : 'home');
  }, [user]);

  const apiFetch = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `Server returned ${res.status}`);
    return json;
  }, [token]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const appData = await apiFetch('/app-data');
      setData(normalizeData(appData));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isAdmin = user?.role === 'admin';
  const tabs = isAdmin ? adminTabs : userTabs;
  const screenProps = { data, refresh, loading, apiFetch, user };
  const renderContent = () => {
    if (error && data.residents.length === 0 && data.expenses.length === 0) {
      return (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={58} color={THEME.muted} />
          <Text style={styles.errorTitle}>Connectivity Issue</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={refresh}>
            <Text style={styles.buttonText}>Reconnect</Text>
          </TouchableOpacity>
        </View>
      );
    }

    switch (activeTab) {
      case 'admin': return <AdminDashboard {...screenProps} />;
      case 'residents': return <ResidentsManager {...screenProps} />;
      case 'messAdmin': return <MessControl {...screenProps} admin />;
      case 'dues': return <DuesManager {...screenProps} />;
      case 'ledger': return <LedgerView {...screenProps} admin />;
      case 'home': return <HostlerDashboard {...screenProps} />;
      case 'mess': return <MessControl {...screenProps} />;
      case 'splits': return <SplitsView {...screenProps} />;
      case 'borrow': return <BorrowView {...screenProps} />;
      case 'chat': return <ChatLedger {...screenProps} />;
      default: return isAdmin ? <AdminDashboard {...screenProps} /> : <HostlerDashboard {...screenProps} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.secondary} />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Nivaas</Text>
          <Text style={styles.headerSub}>{isAdmin ? 'Management Console' : `Room ${user?.roomNo || 'Suite'}`}</Text>
        </View>
        <View style={styles.headerRight}>
          <Avatar name={user?.name} small />
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={20} color={THEME.accent} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.content}>{renderContent()}</View>
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TabItem key={tab.key} {...tab} active={activeTab === tab.key} onPress={() => setActiveTab(tab.key)} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const emptyData = {
  residents: [],
  users: [],
  menus: [],
  feedback: [],
  attendance: [],
  dues: [],
  expenses: [],
  summary: { balances: [], settlements: [] },
  borrows: [],
  messages: [],
  my: { dues: [], borrows: [], balance: { balance: 0 } }
};

const adminTabs = [
  { key: 'admin', label: 'Home', icon: 'grid-outline', activeIcon: 'grid' },
  { key: 'residents', label: 'Residents', icon: 'people-outline', activeIcon: 'people' },
  { key: 'messAdmin', label: 'Mess', icon: 'restaurant-outline', activeIcon: 'restaurant' },
  { key: 'dues', label: 'Billing', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'ledger', label: 'Ledger', icon: 'analytics-outline', activeIcon: 'analytics' }
];

const userTabs = [
  { key: 'home', label: 'Dashboard', icon: 'home-outline', activeIcon: 'home' },
  { key: 'mess', label: 'Mess', icon: 'restaurant-outline', activeIcon: 'restaurant' },
  { key: 'splits', label: 'Splits', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal' },
  { key: 'borrow', label: 'Items', icon: 'repeat-outline', activeIcon: 'repeat' },
  { key: 'chat', label: 'Concierge', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' }
];

function normalizeData(data) {
  return {
    ...emptyData,
    ...data,
    residents: Array.isArray(data?.residents) ? data.residents : [],
    users: Array.isArray(data?.residents) ? data.residents : [],
    menus: Array.isArray(data?.menus) ? data.menus : [],
    feedback: Array.isArray(data?.feedback) ? data.feedback : [],
    attendance: Array.isArray(data?.attendance) ? data.attendance : [],
    dues: Array.isArray(data?.dues) ? data.dues : [],
    expenses: Array.isArray(data?.expenses) ? data.expenses : [],
    borrows: Array.isArray(data?.borrows) ? data.borrows : [],
    messages: Array.isArray(data?.messages) ? data.messages : [],
    summary: data?.summary || emptyData.summary,
    my: data?.my || emptyData.my
  };
}

function TabItem({ label, icon, activeIcon, active, onPress }) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={active ? activeIcon : icon} size={22} color={active ? THEME.accent : '#91A39B'} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AdminDashboard({ data, refresh, loading }) {
  const unpaid = data.dues.filter((due) => due.status !== 'paid');
  const collected = data.dues.reduce((sum, due) => sum + Number(due.paidAmount || 0), 0);
  const attendanceToday = data.attendance.filter((item) => String(item.attendanceDate).slice(0, 10) === todayISO()).length;

  return (
    <AppScroll loading={loading} refresh={refresh}>
      <PremiumHero
        eyebrow="Portfolio Overview"
        title="Institutional Command"
        subtitle="Manage resident relations, mess operations, and fiscal performance from a unified premium dashboard."
        icon="shield-crown-outline"
      />
      <View style={styles.metricsGrid}>
        <MetricCard title="Total Residents" value={data.residents.length} icon="account-group" color={THEME.primary} />
        <MetricCard title="Outstanding Bills" value={unpaid.length} icon="alert-circle-outline" color={THEME.error} />
        <MetricCard title="Revenue Collected" value={currency(collected)} icon="cash-check" color={THEME.success} />
        <MetricCard title="Active Scans" value={attendanceToday} icon="qrcode-scan" color={THEME.accent} />
      </View>
      <Section title="Concierge Ledger">
        <LedgerList messages={data.messages.slice(0, 5)} />
      </Section>
    </AppScroll>
  );
}

function HostlerDashboard({ data, refresh, loading, user }) {
  const todayMenu = data.menus[0];
  const myDue = data.dues.find((due) => due.userId === user?.id || String(due.userId) === String(user?._id)) || data.my?.dues?.[0];
  const balance = Number(data.my?.balance?.balance || 0);

  return (
    <AppScroll loading={loading} refresh={refresh}>
      <PremiumHero
        eyebrow={`Welcome Back, ${user?.name?.split(' ')[0]}`}
        title="Your Lifestyle"
        subtitle="Access your dining menu, current billing statement, and shared roommate expenses."
        icon="crown-outline"
      />
      <View style={styles.metricsGrid}>
        <MetricCard title="Monthly Due" value={currency(myDue?.totalAmount || 0)} icon="receipt" color={THEME.primary} />
        <MetricCard title={balance >= 0 ? 'Receivable' : 'Payable'} value={currency(Math.abs(balance))} icon="wallet-outline" color={balance >= 0 ? THEME.success : THEME.error} />
        <MetricCard title="Borrow Status" value={data.borrows.filter(i => i.status === 'borrowed' && (i.borrowerId === user?.id || i.lenderId === user?.id)).length} icon="repeat" color={THEME.warning} />
        <MetricCard title="Mess Rating" value="4.8/5" icon="star-outline" color={THEME.accent} />
      </View>
      <Section title="Daily Dining">
        {todayMenu ? <MenuCard menu={todayMenu} /> : <EmptyState icon="restaurant-outline" message="Menu is being prepared." />}
      </Section>
    </AppScroll>
  );
}

function ResidentsManager({ data, refresh, loading, apiFetch }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [upiId, setUpiId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addResident = async () => {
    if (!name || !email) return Alert.alert('Missing details', 'Name and email are required.');
    setSubmitting(true);
    try {
      await apiFetch('/admin/residents', {
        method: 'POST',
        body: JSON.stringify({ name, email, roomNo, upiId, password: 'Hostel@123' })
      });
      setName(''); setEmail(''); setRoomNo(''); setUpiId('');
      refresh();
    } catch (error) {
      Alert.alert('Action failed', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.flex1}>
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitleSmall}>Register Resident</Text>
        <LabeledInput label="Legal Name" value={name} onChangeText={setName} placeholder="Enter full name" />
        <LabeledInput label="Email Address" value={email} onChangeText={setEmail} placeholder="resident@nivaas.local" keyboardType="email-address" />
        <View style={styles.twoColumn}>
          <LabeledInput label="Suite #" value={roomNo} onChangeText={setRoomNo} placeholder="B-204" compact />
          <LabeledInput label="Payment Handle" value={upiId} onChangeText={setUpiId} placeholder="name@upi" compact />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={addResident} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm Registration</Text>}
        </TouchableOpacity>
      </View>
      <FlatList
        data={data.residents}
        keyExtractor={(item) => idOf(item)}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={refresh}
        renderItem={({ item }) => (
          <View style={styles.cardItem}>
            <Avatar name={item.name} />
            <View style={styles.itemBody}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.roomNo || 'Suite Pending'} • {item.email}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{item.messPlan || 'Standard'}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="people-outline" message="No residents found." />}
      />
    </View>
  );
}

function MessControl({ data, refresh, loading, apiFetch, admin }) {
  const [menuDate, setMenuDate] = useState(todayISO());
  const [breakfast, setBreakfast] = useState('');
  const [lunch, setLunch] = useState('');
  const [dinner, setDinner] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const saveMenu = async () => {
    if (!menuDate || !breakfast || !lunch || !dinner) return Alert.alert('Incomplete', 'All meal details are required.');
    setSubmitting(true);
    try {
      await apiFetch('/admin/menu', {
        method: 'POST',
        body: JSON.stringify({ menuDate, breakfast, lunch, dinner })
      });
      setBreakfast(''); setLunch(''); setDinner('');
      refresh();
    } catch (error) {
      Alert.alert('Save failed', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScroll loading={loading} refresh={refresh}>
      {admin ? (
        <Section title="Update Daily Cuisine">
          <LabeledInput label="Dining Date" value={menuDate} onChangeText={setMenuDate} placeholder="YYYY-MM-DD" />
          <LabeledInput label="Breakfast Selection" value={breakfast} onChangeText={setBreakfast} placeholder="Morning menu..." />
          <LabeledInput label="Midday Meal" value={lunch} onChangeText={setLunch} placeholder="Afternoon menu..." />
          <LabeledInput label="Evening Dinner" value={dinner} onChangeText={setDinner} placeholder="Night menu..." />
          <TouchableOpacity style={styles.primaryButton} onPress={saveMenu} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Publish Menu</Text>}
          </TouchableOpacity>
        </Section>
      ) : (
        <Section title="Secure Dining Access">
          <View style={styles.qrCard}>
            <MaterialCommunityIcons name="qrcode-scan" size={80} color={THEME.primary} />
            <Text style={styles.qrTitle}>Dining Authorization</Text>
            <Text style={styles.qrSub}>Scan at the entrance to verify your meal credit.</Text>
          </View>
        </Section>
      )}

      <Section title="Historical Menus">
        {data.menus.length ? data.menus.map((menu) => <MenuCard key={idOf(menu)} menu={menu} />) : <EmptyState icon="restaurant-outline" message="No menu data available." />}
      </Section>
    </AppScroll>
  );
}

function DuesManager({ data, refresh, loading, apiFetch }) {
  const [userId, setUserId] = useState('');
  const [billMonth, setBillMonth] = useState(monthISO());
  const [mealsCount, setMealsCount] = useState('60');

  useEffect(() => {
    if (!userId && data.residents[0]) setUserId(idOf(data.residents[0]));
  }, [data.residents, userId]);

  const saveDue = async () => {
    try {
      await apiFetch('/admin/dues', {
        method: 'POST',
        body: JSON.stringify({ userId, billMonth, mealsCount })
      });
      refresh();
      Alert.alert('Success', 'Statement has been updated.');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <AppScroll loading={loading} refresh={refresh}>
      <Section title="Fiscal Statement Generator">
        <Text style={styles.label}>Select Resident</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
          {data.residents.map((resident) => (
            <TouchableOpacity key={idOf(resident)} style={[styles.pill, userId === idOf(resident) && styles.pillActive]} onPress={() => setUserId(idOf(resident))}>
              <Text style={[styles.pillText, userId === idOf(resident) && styles.pillTextActive]}>{resident.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.twoColumn}>
          <LabeledInput label="Billing Cycle" value={billMonth} onChangeText={setBillMonth} placeholder="YYYY-MM" compact />
          <LabeledInput label="Meal Credits" value={mealsCount} onChangeText={setMealsCount} keyboardType="numeric" compact />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={saveDue}>
          <Text style={styles.buttonText}>Finalize Statement</Text>
        </TouchableOpacity>
      </Section>
      <Section title="Audit Trail">
        {data.dues.map((due) => <DueCard key={idOf(due)} due={due} />)}
      </Section>
    </AppScroll>
  );
}

function SplitsView({ data, refresh, loading, apiFetch, user }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <View style={styles.flex1}>
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
      <FlatList
        data={data.expenses}
        keyExtractor={(item) => idOf(item)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={THEME.primary} />}
        ListHeaderComponent={() => (
          <>
            <PremiumHero eyebrow="Asset Management" title="Expense Splits" subtitle="Seamlessly track and settle shared costs with room mates using institutional-grade ledgering." icon="cash-multiple" />
            <SettlementList settlements={data.summary.settlements} apiFetch={apiFetch} residents={data.residents} />
          </>
        )}
        renderItem={({ item }) => <ExpenseCard expense={item} />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" message="No transactions recorded." />}
      />
      <ExpenseModal visible={showModal} onClose={() => setShowModal(false)} data={data} apiFetch={apiFetch} refresh={refresh} user={user} />
    </View>
  );
}

function BorrowView({ data, refresh, loading, apiFetch, user }) {
  const [itemName, setItemName] = useState('');
  const [otherUser, setOtherUser] = useState('');
  const [direction, setDirection] = useState('lent');

  useEffect(() => {
    const firstOther = data.residents.find((resident) => resident.id !== user?.id);
    if (!otherUser && firstOther) setOtherUser(idOf(firstOther));
  }, [data.residents, otherUser, user?.id]);

  const saveBorrow = async () => {
    if (!itemName || !otherUser) return Alert.alert('Incomplete', 'Item and resident details are required.');
    try {
      await apiFetch('/borrow', {
        method: 'POST',
        body: JSON.stringify({
          lenderId: direction === 'lent' ? user.id : otherUser,
          borrowerId: direction === 'lent' ? otherUser : user.id,
          itemName, notes: '', dueDate: null
        })
      });
      setItemName('');
      refresh();
    } catch (error) {
      Alert.alert('Action failed', error.message);
    }
  };

  const markReturned = async (id) => {
    try {
      await apiFetch(`/borrow/${id}/return`, { method: 'PATCH' });
      refresh();
    } catch (error) {
      Alert.alert('Update failed', error.message);
    }
  };

  return (
    <AppScroll loading={loading} refresh={refresh}>
      <Section title="Asset Movement Tracker">
        <View style={styles.segment}>
          <TouchableOpacity style={[styles.segmentButton, direction === 'lent' && styles.segmentActive]} onPress={() => setDirection('lent')}>
            <Text style={[styles.segmentText, direction === 'lent' && styles.segmentTextActive]}>Lent Item</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentButton, direction === 'borrowed' && styles.segmentActive]} onPress={() => setDirection('borrowed')}>
            <Text style={[styles.segmentText, direction === 'borrowed' && styles.segmentTextActive]}>Borrowed Item</Text>
          </TouchableOpacity>
        </View>
        <LabeledInput label="Asset Description" value={itemName} onChangeText={setItemName} placeholder="E.g. Digital equipment, textbooks..." />
        <Text style={styles.label}>Associated Resident</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
          {data.residents.filter((resident) => resident.id !== user?.id).map((resident) => (
            <TouchableOpacity key={idOf(resident)} style={[styles.pill, otherUser === idOf(resident) && styles.pillActive]} onPress={() => setOtherUser(idOf(resident))}>
              <Text style={[styles.pillText, otherUser === idOf(resident) && styles.pillTextActive]}>{resident.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.primaryButton} onPress={saveBorrow}>
          <Text style={styles.buttonText}>Log Transaction</Text>
        </TouchableOpacity>
      </Section>
      <Section title="Active Inventory">
        {data.borrows.map((item) => <BorrowCard key={idOf(item)} item={item} onReturn={markReturned} />)}
      </Section>
    </AppScroll>
  );
}

function LedgerView({ data, refresh, loading }) {
  return (
    <AppScroll loading={loading} refresh={refresh}>
      <PremiumHero eyebrow="Institutional Audit" title="Unified Ledger" subtitle="A comprehensive trail of dining, fiscal, and resident interactions." icon="clipboard-list-outline" />
      <Section title="Resident Balances">
        <BalanceList balances={data.summary.balances} />
      </Section>
      <Section title="Communication History">
        <LedgerList messages={data.messages} />
      </Section>
    </AppScroll>
  );
}

function ChatLedger({ data, refresh, loading, apiFetch }) {
  const [message, setMessage] = useState('');

  const send = async () => {
    if (!message) return;
    try {
      await apiFetch('/messages', {
        method: 'POST',
        body: JSON.stringify({ message, ledgerTag: 'chat' })
      });
      setMessage('');
      refresh();
    } catch (error) {
      Alert.alert('Dispatch failed', error.message);
    }
  };

  return (
    <View style={styles.flex1}>
      <FlatList
        data={data.messages}
        keyExtractor={(item) => idOf(item)}
        inverted
        contentContainerStyle={styles.chatList}
        refreshing={loading}
        onRefresh={refresh}
        renderItem={({ item }) => <MessageBubble item={item} />}
        ListEmptyComponent={<EmptyState icon="chatbubbles-outline" message="No concierge messages yet." />}
      />
      <View style={styles.composer}>
        <View style={styles.composerRow}>
          <TextInput style={styles.composerInput} value={message} onChangeText={setMessage} placeholder="Enter message..." placeholderTextColor={THEME.muted} />
          <TouchableOpacity style={styles.sendButton} onPress={send}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ExpenseModal({ visible, onClose, data, apiFetch, refresh, user }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [participants, setParticipants] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && data.residents.length) {
      setPaidBy(String(user?.id || data.residents[0].id));
      setParticipants(data.residents.map((resident) => idOf(resident)));
    }
  }, [visible, data.residents, user?.id]);

  const toggle = (id) => {
    setParticipants((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const save = async () => {
    if (!description || !amount || !paidBy || !participants.length) return Alert.alert('Incomplete', 'Please fill all fields.');
    setSubmitting(true);
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({ description, amount, paidBy, participants, date: new Date().toISOString() })
      });
      onClose(); refresh();
    } catch (error) {
      Alert.alert('Failed', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Expenditure</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
              <Ionicons name="close" size={26} color={THEME.ink} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <LabeledInput label="Item Description" value={description} onChangeText={setDescription} placeholder="E.g. Shared Utilities" />
            <LabeledInput label="Transaction Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" />
            <Text style={styles.label}>Settled By</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {data.residents.map((resident) => (
                <TouchableOpacity key={idOf(resident)} style={[styles.pill, paidBy === idOf(resident) && styles.pillActive]} onPress={() => setPaidBy(idOf(resident))}>
                  <Text style={[styles.pillText, paidBy === idOf(resident) && styles.pillTextActive]}>{resident.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Split Distribution</Text>
            <View style={styles.checkboxGrid}>
              {data.residents.map((resident) => (
                <TouchableOpacity key={idOf(resident)} style={[styles.checkbox, participants.includes(idOf(resident)) && styles.checkboxActive]} onPress={() => toggle(idOf(resident))}>
                  <Ionicons name={participants.includes(idOf(resident)) ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={participants.includes(idOf(resident)) ? THEME.primary : THEME.muted} />
                  <Text style={[styles.checkboxLabel, participants.includes(idOf(resident)) && styles.checkboxLabelActive]}>{resident.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={save} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm Allocation</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Visual Components
function AppScroll({ children, loading, refresh }) {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={THEME.primary} />}>
      {children}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function PremiumHero({ eyebrow, title, subtitle, icon }) {
  return (
    <View style={styles.heroSection}>
      <View style={styles.heroTop}>
        <View style={styles.heroIconBox}>
          <MaterialCommunityIcons name={icon} size={28} color={THEME.accent} />
        </View>
        <Text style={styles.heroEyebrow}>{eyebrow}</Text>
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
    </View>
  );
}

function MetricCard({ title, value, icon, color }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}0A` }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.cardContainer}>{children}</View>
    </View>
  );
}

function LabeledInput({ label, compact, ...props }) {
  return (
    <View style={compact ? styles.compactInput : { marginBottom: 12 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput {...props} style={styles.textInput} placeholderTextColor="#A1A1A1" />
    </View>
  );
}

function MenuCard({ menu }) {
  return (
    <View style={styles.menuCard}>
      <View style={styles.menuHeader}>
        <Text style={styles.menuDate}>{shortDate(menu.menuDate)}</Text>
        <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>Gourmet</Text></View>
      </View>
      <MealRow icon="weather-sunny" label="Morning" value={menu.breakfast} />
      <MealRow icon="white-balance-sunny" label="Midday" value={menu.lunch} />
      <MealRow icon="weather-night" label="Evening" value={menu.dinner} />
    </View>
  );
}

function MealRow({ icon, label, value }) {
  return (
    <View style={styles.mealRow}>
      <MaterialCommunityIcons name={icon} size={18} color={THEME.accent} />
      <Text style={styles.mealLabel}>{label}</Text>
      <Text style={styles.mealValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function DueCard({ due }) {
  const color = due.status === 'paid' ? THEME.success : THEME.error;
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemBody}>
        <Text style={styles.itemName}>{due.name}</Text>
        <Text style={styles.itemMeta}>{due.billMonth} Cycle • {due.mealsCount} Credits</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.itemPrice}>{currency(due.totalAmount)}</Text>
        <Text style={[styles.statusTextSmall, { color }]}>{due.status}</Text>
      </View>
    </View>
  );
}

function ExpenseCard({ expense }) {
  return (
    <View style={styles.cardItem}>
      <View style={[styles.iconCircle, { backgroundColor: THEME.soft }]}>
        <Ionicons name="receipt-outline" size={20} color={THEME.primary} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemName}>{expense.description}</Text>
        <Text style={styles.itemMeta}>{expense.paidBy?.name} settled • {shortDate(expense.date)}</Text>
      </View>
      <Text style={styles.itemPrice}>{currency(expense.amount)}</Text>
    </View>
  );
}

function BorrowCard({ item, onReturn }) {
  const active = item.status === 'borrowed';
  return (
    <View style={styles.cardItem}>
      <View style={[styles.iconCircle, { backgroundColor: active ? `${THEME.warning}10` : `${THEME.success}10` }]}>
        <Ionicons name={active ? 'hourglass-outline' : 'checkmark-done'} size={20} color={active ? THEME.warning : THEME.success} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemName}>{item.itemName}</Text>
        <Text style={styles.itemMeta}>{item.lenderName} to {item.borrowerName}</Text>
      </View>
      {active && onReturn ? (
        <TouchableOpacity style={styles.actionBadge} onPress={() => onReturn(item.id)}>
          <Text style={styles.actionBadgeText}>Return</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.statusTextSmall, { color: active ? THEME.warning : THEME.success }]}>{item.status}</Text>
      )}
    </View>
  );
}

function SettlementList({ settlements, apiFetch, residents }) {
  if (!settlements?.length) return <EmptyState icon="checkmark-circle-outline" message="All accounts are settled." />;
  return settlements.map((s, i) => (
    <View key={i} style={styles.settlementItem}>
      <Ionicons name="swap-horizontal" size={20} color={THEME.accent} style={{ marginRight: 12 }} />
      <View style={styles.itemBody}>
        <Text style={styles.itemName}>{s.from} → {s.to}</Text>
        <Text style={styles.itemMeta}>Inter-resident reconciliation</Text>
      </View>
      <Text style={styles.itemPrice}>{currency(s.amount)}</Text>
    </View>
  ));
}

function BalanceList({ balances }) {
  return balances.map((b) => {
    const pos = Number(b.balance) >= 0;
    return (
      <View key={b.userId} style={styles.itemRow}>
        <Avatar name={b.name} small />
        <View style={styles.itemBody}>
          <Text style={styles.itemName}>{b.name}</Text>
          <Text style={[styles.itemMeta, { color: pos ? THEME.success : THEME.error }]}>{pos ? 'Credit Balance' : 'Outstanding Debt'}</Text>
        </View>
        <Text style={[styles.itemPrice, { color: pos ? THEME.success : THEME.error }]}>{currency(Math.abs(b.balance))}</Text>
      </View>
    );
  });
}

function LedgerList({ messages }) {
  return messages.map((m) => (
    <View key={idOf(m)} style={styles.ledgerItem}>
      <View style={styles.ledgerHeader}>
        <Text style={styles.ledgerUser}>{m.name}</Text>
        <Text style={styles.ledgerTime}>{shortDate(m.createdAt)}</Text>
      </View>
      <Text style={styles.ledgerText}>{m.message}</Text>
    </View>
  ));
}

function MessageBubble({ item }) {
  return (
    <View style={styles.messageBubble}>
      <Text style={styles.messageName}>{item.name}</Text>
      <Text style={styles.messageText}>{item.message}</Text>
      <Text style={styles.messageTime}>{shortDate(item.createdAt)}</Text>
    </View>
  );
}

function Avatar({ name, small }) {
  return (
    <View style={small ? styles.avatarSmall : styles.avatar}>
      <Text style={small ? styles.avatarTextSmall : styles.avatarText}>{name?.charAt(0) || 'N'}</Text>
    </View>
  );
}

function EmptyState({ icon, message }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name={icon} size={48} color={THEME.border} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  flex1: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.background },
  header: { height: 85, paddingHorizontal: 20, backgroundColor: THEME.secondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: THEME.primary },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: THEME.accent, fontWeight: '600', marginTop: -2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  logoutButton: { marginLeft: 15, padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  content: { flex: 1 },
  tabBar: { height: Platform.OS === 'ios' ? 88 : 70, backgroundColor: THEME.secondary, flexDirection: 'row', borderTopWidth: 1, borderTopColor: THEME.primary, paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '700', marginTop: 5, color: '#91A39B' },
  tabLabelActive: { color: THEME.accent },
  scrollView: { flex: 1, padding: 20 },
  heroSection: { padding: 24, backgroundColor: THEME.secondary, borderRadius: 20, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  heroIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  heroEyebrow: { fontSize: 12, fontWeight: '800', color: THEME.accent, textTransform: 'uppercase', letterSpacing: 1 },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.8 },
  heroSubtitle: { fontSize: 15, color: '#C8D3CE', lineHeight: 22, marginTop: 10 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  metricCard: { width: '48%', backgroundColor: THEME.surface, borderRadius: 16, padding: 18, marginBottom: 15, shadowColor: THEME.shadow, shadowOpacity: 1, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: THEME.border },
  metricIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  metricValue: { fontSize: 20, fontWeight: '800', color: THEME.ink },
  metricTitle: { fontSize: 12, color: THEME.muted, fontWeight: '700', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: THEME.ink, marginBottom: 15, letterSpacing: -0.4 },
  cardContainer: { backgroundColor: THEME.surface, borderRadius: 16, padding: 5, borderWidth: 1, borderColor: THEME.border },
  authContainer: { flex: 1, backgroundColor: THEME.secondary, justifyContent: 'center', padding: 24 },
  authPanel: { backgroundColor: THEME.surface, borderRadius: 24, padding: 32, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 30, elevation: 10 },
  brandMark: { width: 80, height: 80, borderRadius: 20, backgroundColor: THEME.secondary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  authTitle: { fontSize: 36, fontWeight: '800', color: THEME.ink, textAlign: 'center' },
  authTitleSmall: { fontSize: 28, fontWeight: '800', color: THEME.ink, marginBottom: 8 },
  authSubtitle: { fontSize: 16, color: THEME.muted, textAlign: 'center', marginBottom: 25 },
  roleGrid: { flexDirection: 'row', gap: 15, marginTop: 10 },
  roleCard: { flex: 1, backgroundColor: THEME.soft, padding: 20, borderRadius: 16, alignItems: 'center' },
  roleCardActive: { backgroundColor: THEME.primary },
  roleIconCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  roleText: { fontSize: 15, fontWeight: '800', color: THEME.primary },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  demoBox: { backgroundColor: THEME.soft, padding: 15, borderRadius: 16, marginBottom: 20 },
  demoTitle: { fontSize: 12, fontWeight: '800', color: THEME.muted, textTransform: 'uppercase', marginBottom: 10 },
  demoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: THEME.border },
  demoButtonText: { fontSize: 14, fontWeight: '700', color: THEME.primary },
  inputLabel: { fontSize: 13, fontWeight: '700', color: THEME.ink, marginBottom: 8, marginLeft: 4 },
  textInput: { height: 52, backgroundColor: '#fff', borderWidth: 1, borderColor: THEME.border, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: THEME.ink },
  primaryButton: { height: 56, backgroundColor: THEME.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  formContainer: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: THEME.border },
  sectionTitleSmall: { fontSize: 18, fontWeight: '800', color: THEME.ink, marginBottom: 15 },
  twoColumn: { flexDirection: 'row', gap: 12 },
  compactInput: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 100 },
  cardItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: THEME.border },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center' },
  avatarSmall: { width: 34, height: 34, borderRadius: 10, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  avatarTextSmall: { color: '#fff', fontSize: 14, fontWeight: '800' },
  itemBody: { flex: 1, marginLeft: 15 },
  itemName: { fontSize: 16, fontWeight: '800', color: THEME.ink },
  itemMeta: { fontSize: 13, color: THEME.muted, marginTop: 2 },
  itemPrice: { fontSize: 16, fontWeight: '800', color: THEME.ink },
  statusBadge: { backgroundColor: THEME.soft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800', color: THEME.primary, textTransform: 'uppercase' },
  qrCard: { alignItems: 'center', padding: 40, borderStyle: 'dashed', borderWidth: 2, borderColor: THEME.border, borderRadius: 20, backgroundColor: '#F9FBF9' },
  qrTitle: { fontSize: 22, fontWeight: '800', color: THEME.ink, marginTop: 15 },
  qrSub: { fontSize: 14, color: THEME.muted, textAlign: 'center', marginTop: 8 },
  menuCard: { padding: 15 },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  menuDate: { fontSize: 18, fontWeight: '800', color: THEME.ink },
  menuBadge: { backgroundColor: `${THEME.accent}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  menuBadgeText: { fontSize: 10, fontWeight: '800', color: THEME.accent, textTransform: 'uppercase' },
  mealRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  mealLabel: { width: 70, marginLeft: 10, fontSize: 13, fontWeight: '800', color: THEME.muted },
  mealValue: { flex: 1, fontSize: 14, fontWeight: '700', color: THEME.ink },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: THEME.border },
  statusTextSmall: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 4 },
  pillScroll: { marginBottom: 15 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: THEME.soft, marginRight: 10, borderWidth: 1, borderColor: THEME.border },
  pillActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  pillText: { fontSize: 13, fontWeight: '800', color: THEME.primary },
  pillTextActive: { color: '#fff' },
  label: { fontSize: 14, fontWeight: '800', color: THEME.ink, marginBottom: 10 },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 64, height: 64, borderRadius: 32, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: THEME.ink },
  closeIcon: { padding: 5 },
  checkboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  checkbox: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.soft, padding: 12, borderRadius: 12, width: '48%' },
  checkboxActive: { backgroundColor: `${THEME.primary}10`, borderWidth: 1, borderColor: THEME.primary },
  checkboxLabel: { fontSize: 12, fontWeight: '700', color: THEME.muted, marginLeft: 8 },
  checkboxLabelActive: { color: THEME.primary },
  settlementItem: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: THEME.border },
  actionBadge: { backgroundColor: THEME.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  actionBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  chatList: { padding: 20 },
  messageBubble: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: THEME.border },
  messageName: { fontSize: 13, fontWeight: '800', color: THEME.primary, marginBottom: 4 },
  messageText: { fontSize: 15, color: THEME.ink, lineHeight: 22 },
  messageTime: { fontSize: 11, color: THEME.muted, marginTop: 8, textAlign: 'right' },
  composer: { padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: THEME.border },
  composerRow: { flexDirection: 'row', alignItems: 'center' },
  composerInput: { flex: 1, height: 48, backgroundColor: THEME.soft, borderRadius: 24, paddingHorizontal: 20, fontSize: 15, color: THEME.ink },
  sendButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  ledgerItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: THEME.border },
  ledgerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  ledgerUser: { fontSize: 14, fontWeight: '800', color: THEME.ink },
  ledgerTime: { fontSize: 12, color: THEME.muted },
  ledgerText: { fontSize: 14, color: THEME.muted, lineHeight: 20 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 14, fontWeight: '700', color: THEME.border, marginTop: 10 },
  errorTitle: { fontSize: 24, fontWeight: '800', color: THEME.ink, marginTop: 20 },
  errorSubtitle: { fontSize: 15, color: THEME.muted, textAlign: 'center', marginTop: 10, marginBottom: 30 }
});
