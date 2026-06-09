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
  primary: '#204e4a',
  secondary: '#102927',
  accent: '#b88a2e',
  ink: '#17201f',
  muted: '#66736f',
  background: '#f5f2ea',
  surface: '#ffffff',
  soft: '#ebe4d5',
  success: '#167449',
  error: '#bb3e35',
  warning: '#a96e14',
  border: '#ded6c7',
  shadow: 'rgba(20, 27, 25, 0.12)'
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.authContainer}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.secondary} />
      <View style={styles.authPanel}>
        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="silverware-fork-knife" size={34} color={THEME.accent} />
        </View>
        <Text style={styles.authTitle}>HostelLedger</Text>
        <Text style={styles.authSubtitle}>Select your role and sign in to continue.</Text>

        <TouchableOpacity style={styles.roleButton} onPress={() => onSelectRole('user')}>
          <Text style={styles.buttonTextLarge}>User</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.roleButton, styles.roleButtonSecondary]} onPress={() => onSelectRole('admin')}>
          <Text style={styles.buttonTextLarge}>Admin</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="silverware-fork-knife" size={34} color={THEME.accent} />
        </View>
        <Text style={styles.authTitle}>Sign in as {role === 'admin' ? 'Admin' : 'User'}</Text>
        <Text style={styles.authSubtitle}>Enter your email and password to access the dashboard.</Text>
        {role === 'admin' ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.loginHint}>Admin login details:</Text>
            <Text style={styles.loginHintBold}>Email: newadmin@hostel.local</Text>
            <Text style={styles.loginHintBold}>Password: NewAdmin@123</Text>
            <TouchableOpacity style={[styles.smallAction, { marginTop: 10, alignSelf: 'center' }]} onPress={() => { setEmail('newadmin@hostel.local'); setPassword('NewAdmin@123'); }}>
              <Text style={styles.smallActionText}>Fill admin credentials</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.loginHint}>User login details:</Text>
            <Text style={styles.loginHintBold}>Email: ramana@hostel.local</Text>
            <Text style={styles.loginHintBold}>Password: ramana@123</Text>
            <TouchableOpacity style={[styles.smallAction, { marginTop: 10, alignSelf: 'center' }]} onPress={() => { setEmail('ramana@hostel.local'); setPassword('ramana@123'); }}>
              <Text style={styles.smallActionText}>Fill user credentials</Text>
            </TouchableOpacity>
          </View>
        )}

        <LabeledInput label="Email" value={email} onChangeText={setEmail} placeholder="you@hostel.local" keyboardType="email-address" autoCapitalize="none" />
        <LabeledInput label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />

        <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallAction, { marginTop: 12 }]} onPress={onBack}>
          <Text style={styles.smallActionText}>Choose a different role</Text>
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
          <Text style={styles.errorTitle}>Cannot load hostel data</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={refresh}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    switch (activeTab) {
      case 'admin':
        return <AdminDashboard {...screenProps} />;
      case 'residents':
        return <ResidentsManager {...screenProps} />;
      case 'messAdmin':
        return <MessControl {...screenProps} admin />;
      case 'dues':
        return <DuesManager {...screenProps} />;
      case 'ledger':
        return <LedgerView {...screenProps} admin />;
      case 'home':
        return <HostlerDashboard {...screenProps} />;
      case 'mess':
        return <MessControl {...screenProps} />;
      case 'splits':
        return <SplitsView {...screenProps} />;
      case 'borrow':
        return <BorrowView {...screenProps} />;
      case 'chat':
        return <ChatLedger {...screenProps} />;
      default:
        return isAdmin ? <AdminDashboard {...screenProps} /> : <HostlerDashboard {...screenProps} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.secondary} />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>HostelLedger</Text>
          <Text style={styles.headerSub}>{isAdmin ? 'Management dashboard' : `${user?.roomNo || 'Hostler'} dashboard`}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{isAdmin ? 'Admin' : 'Hostler'}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutIcon}>
            <Ionicons name="log-out-outline" size={21} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color={THEME.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
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
  { key: 'admin', label: 'Admin', icon: 'grid-outline', activeIcon: 'grid' },
  { key: 'residents', label: 'Users', icon: 'people-outline', activeIcon: 'people' },
  { key: 'messAdmin', label: 'Mess', icon: 'restaurant-outline', activeIcon: 'restaurant' },
  { key: 'dues', label: 'Dues', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'ledger', label: 'Ledger', icon: 'analytics-outline', activeIcon: 'analytics' }
];

const userTabs = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { key: 'mess', label: 'Mess', icon: 'restaurant-outline', activeIcon: 'restaurant' },
  { key: 'splits', label: 'Split', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal' },
  { key: 'borrow', label: 'Borrow', icon: 'repeat-outline', activeIcon: 'repeat' },
  { key: 'chat', label: 'Chat', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' }
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
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={active ? activeIcon : icon} size={22} color={active ? THEME.accent : '#d7dfdc'} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function AdminDashboard({ data, refresh, loading }) {
  const unpaid = data.dues.filter((due) => due.status !== 'paid');
  const collected = data.dues.reduce((sum, due) => sum + Number(due.paidAmount || 0), 0);
  const attendanceToday = data.attendance.filter((item) => String(item.attendanceDate).slice(0, 10) === todayISO()).length;
  const avgRating = data.feedback.length ? (data.feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / data.feedback.length).toFixed(1) : '0.0';

  return (
    <AppScroll loading={loading} refresh={refresh}>
      <PremiumHero
        eyebrow="Hostel management"
        title="Mess, money, and roommate operations"
        subtitle="Track meals, monthly dues, resident payments, borrow items, shared spends, and chat-ledger activity from one command center."
        icon="shield-crown-outline"
      />
      <View style={styles.metricsGrid}>
        <MetricCard title="Hostlers" value={data.residents.length} icon="account-group" color={THEME.primary} />
        <MetricCard title="Pending dues" value={unpaid.length} icon="alert-circle-outline" color={THEME.error} />
        <MetricCard title="Collected" value={currency(collected)} icon="cash-check" color={THEME.success} />
        <MetricCard title="Today scans" value={attendanceToday} icon="qrcode-scan" color={THEME.accent} />
      </View>
      <Section title="Mess health">
        <View style={styles.insightRow}>
          <Insight title="Feedback score" value={`${avgRating}/5`} detail={`${data.feedback.length} recent reviews`} />
          <Insight title="Active borrows" value={data.borrows.filter((item) => item.status === 'borrowed').length} detail="items still pending" />
        </View>
      </Section>
      <Section title="Recent ledger">
        <LedgerList messages={data.messages.slice(0, 5)} />
      </Section>
    </AppScroll>
  );
}

function HostlerDashboard({ data, refresh, loading, user }) {
  const todayMenu = data.menus[0];
  const myDue = data.dues.find((due) => due.userId === user?.id || String(due.userId) === String(user?._id)) || data.my?.dues?.[0];
  const balance = Number(data.my?.balance?.balance || 0);
  const pendingBorrow = data.borrows.filter((item) => item.status === 'borrowed' && (item.borrowerId === user?.id || item.lenderId === user?.id)).length;

  return (
    <AppScroll loading={loading} refresh={refresh}>
      <PremiumHero
        eyebrow={`Room ${user?.roomNo || 'Hostel'}`}
        title={`Hi, ${user?.name || 'Hostler'}`}
        subtitle="Your mess menu, monthly bill, roommate split balance, borrowed items, and hostel chat are ready."
        icon="bed-king-outline"
      />
      <View style={styles.metricsGrid}>
        <MetricCard title="Mess bill" value={currency(myDue?.totalAmount || 0)} icon="food" color={THEME.primary} />
        <MetricCard title={balance >= 0 ? 'To receive' : 'To pay'} value={currency(Math.abs(balance))} icon="scale-balance" color={balance >= 0 ? THEME.success : THEME.error} />
        <MetricCard title="Borrow items" value={pendingBorrow} icon="repeat" color={THEME.warning} />
        <MetricCard title="Split entries" value={data.expenses.length} icon="cash-multiple" color={THEME.accent} />
      </View>
      <Section title="Today menu">
        {todayMenu ? <MenuCard menu={todayMenu} /> : <EmptyState icon="restaurant-outline" message="No mess menu posted yet." />}
      </Section>
      <Section title="Settlement shortcuts">
        <SettlementList settlements={data.summary.settlements.slice(0, 3)} />
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
        body: JSON.stringify({ name, email, roomNo, upiId, password: DEMO_PASSWORD })
      });
      setName('');
      setEmail('');
      setRoomNo('');
      setUpiId('');
      refresh();
    } catch (error) {
      Alert.alert('Resident not added', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.flex1}>
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitleSmall}>Add hostler</Text>
        <LabeledInput label="Name" value={name} onChangeText={setName} placeholder="Resident name" />
        <LabeledInput label="Email" value={email} onChangeText={setEmail} placeholder="resident@hostel.local" keyboardType="email-address" autoCapitalize="none" />
        <View style={styles.twoColumn}>
          <LabeledInput label="Room" value={roomNo} onChangeText={setRoomNo} placeholder="B-204" compact />
          <LabeledInput label="UPI ID" value={upiId} onChangeText={setUpiId} placeholder="name@upi" compact />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={addResident} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create hostler</Text>}
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
              <Text style={styles.itemMeta}>{item.roomNo || 'No room'} | {item.email}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{item.messPlan || 'standard'}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="people-outline" message="No hostlers yet." />}
      />
    </View>
  );
}

function MessControl({ data, refresh, loading, apiFetch, admin }) {
  const [menuDate, setMenuDate] = useState(todayISO());
  const [breakfast, setBreakfast] = useState('');
  const [lunch, setLunch] = useState('');
  const [dinner, setDinner] = useState('');
  const [specialNote, setSpecialNote] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const saveMenu = async () => {
    if (!menuDate || !breakfast || !lunch || !dinner) return Alert.alert('Missing menu', 'Date, breakfast, lunch, and dinner are required.');
    setSubmitting(true);
    try {
      await apiFetch('/admin/menu', {
        method: 'POST',
        body: JSON.stringify({ menuDate, breakfast, lunch, dinner, specialNote })
      });
      setBreakfast('');
      setLunch('');
      setDinner('');
      setSpecialNote('');
      refresh();
    } catch (error) {
      Alert.alert('Menu not saved', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const markAttendance = async (meal) => {
    try {
      await apiFetch('/attendance', {
        method: 'POST',
        body: JSON.stringify({ meal, attendanceDate: todayISO(), source: 'qr' })
      });
      Alert.alert('Attendance marked', `${meal} attendance recorded from QR.`);
      refresh();
    } catch (error) {
      Alert.alert('Attendance failed', error.message);
    }
  };

  const sendFeedback = async () => {
    try {
      await apiFetch('/feedback', {
        method: 'POST',
        body: JSON.stringify({ menuDate: todayISO(), rating, comment })
      });
      setComment('');
      Alert.alert('Thanks', 'Mess feedback submitted.');
      refresh();
    } catch (error) {
      Alert.alert('Feedback failed', error.message);
    }
  };

  return (
    <AppScroll loading={loading} refresh={refresh}>
      {admin ? (
        <Section title="Post daily mess menu">
          <LabeledInput label="Date" value={menuDate} onChangeText={setMenuDate} placeholder="YYYY-MM-DD" />
          <LabeledInput label="Breakfast" value={breakfast} onChangeText={setBreakfast} placeholder="Poha, eggs, chai" />
          <LabeledInput label="Lunch" value={lunch} onChangeText={setLunch} placeholder="Rajma rice, salad" />
          <LabeledInput label="Dinner" value={dinner} onChangeText={setDinner} placeholder="Paneer, roti, dal" />
          <LabeledInput label="Notice" value={specialNote} onChangeText={setSpecialNote} placeholder="QR closes after 20 minutes" />
          <TouchableOpacity style={styles.primaryButton} onPress={saveMenu} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Publish menu</Text>}
          </TouchableOpacity>
        </Section>
      ) : (
        <Section title="QR mess attendance">
          <View style={styles.qrCard}>
            <MaterialCommunityIcons name="qrcode-scan" size={64} color={THEME.secondary} />
            <Text style={styles.qrTitle}>Hostel mess QR</Text>
            <Text style={styles.qrSub}>Tap a meal to simulate scan-based attendance.</Text>
          </View>
          <View style={styles.actionRow}>
            {['breakfast', 'lunch', 'dinner'].map((meal) => (
              <TouchableOpacity key={meal} style={styles.smallAction} onPress={() => markAttendance(meal)}>
                <Text style={styles.smallActionText}>{meal}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>
      )}

      <Section title="Menus">
        {data.menus.length ? data.menus.map((menu) => <MenuCard key={idOf(menu)} menu={menu} />) : <EmptyState icon="restaurant-outline" message="No menus posted yet." />}
      </Section>

      {!admin ? (
        <Section title="Feedback">
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Ionicons name={star <= rating ? 'star' : 'star-outline'} size={28} color={THEME.accent} />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={comment}
            onChangeText={setComment}
            placeholder="Food quality, hygiene, quantity..."
            placeholderTextColor={THEME.muted}
            multiline
          />
          <TouchableOpacity style={styles.primaryButton} onPress={sendFeedback}>
            <Text style={styles.buttonText}>Send feedback</Text>
          </TouchableOpacity>
        </Section>
      ) : (
        <Section title="Latest feedback">
          {data.feedback.slice(0, 8).map((item) => (
            <View key={idOf(item)} style={styles.commentItem}>
              <Text style={styles.itemName}>{item.name} | {item.rating}/5</Text>
              <Text style={styles.itemMeta}>{item.roomNo || 'Room'} | {shortDate(item.createdAt)}</Text>
              <Text style={styles.commentText}>{item.comment || 'No comment'}</Text>
            </View>
          ))}
        </Section>
      )}
    </AppScroll>
  );
}

function DuesManager({ data, refresh, loading, apiFetch }) {
  const [userId, setUserId] = useState('');
  const [billMonth, setBillMonth] = useState(monthISO());
  const [mealsCount, setMealsCount] = useState('56');
  const [ratePerMeal, setRatePerMeal] = useState('55');
  const [fixedCharges, setFixedCharges] = useState('400');
  const [paidAmount, setPaidAmount] = useState('0');
  const [status, setStatus] = useState('unpaid');

  useEffect(() => {
    if (!userId && data.residents[0]) setUserId(idOf(data.residents[0]));
  }, [data.residents, userId]);

  const saveDue = async () => {
    try {
      await apiFetch('/admin/dues', {
        method: 'POST',
        body: JSON.stringify({ userId, billMonth, mealsCount, ratePerMeal, fixedCharges, paidAmount, status })
      });
      refresh();
      Alert.alert('Bill updated', 'Monthly mess due has been recalculated.');
    } catch (error) {
      Alert.alert('Due not saved', error.message);
    }
  };

  return (
    <AppScroll loading={loading} refresh={refresh}>
      <Section title="Auto monthly mess bill">
        <Text style={styles.label}>Hostler</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
          {data.residents.map((resident) => (
            <TouchableOpacity key={idOf(resident)} style={[styles.pill, userId === idOf(resident) && styles.pillActive]} onPress={() => setUserId(idOf(resident))}>
              <Text style={[styles.pillText, userId === idOf(resident) && styles.pillTextActive]}>{resident.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.twoColumn}>
          <LabeledInput label="Month" value={billMonth} onChangeText={setBillMonth} placeholder="YYYY-MM" compact />
          <LabeledInput label="Meals" value={mealsCount} onChangeText={setMealsCount} keyboardType="numeric" compact />
        </View>
        <View style={styles.twoColumn}>
          <LabeledInput label="Rate" value={ratePerMeal} onChangeText={setRatePerMeal} keyboardType="numeric" compact />
          <LabeledInput label="Fixed" value={fixedCharges} onChangeText={setFixedCharges} keyboardType="numeric" compact />
        </View>
        <View style={styles.twoColumn}>
          <LabeledInput label="Paid" value={paidAmount} onChangeText={setPaidAmount} keyboardType="numeric" compact />
          <LabeledInput label="Status" value={status} onChangeText={setStatus} placeholder="paid/partial/unpaid" compact />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={saveDue}>
          <Text style={styles.buttonText}>Save mess bill</Text>
        </TouchableOpacity>
      </Section>
      <Section title="Who paid / who didn't">
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
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
      <FlatList
        data={data.expenses}
        keyExtractor={(item) => idOf(item)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListHeaderComponent={() => (
          <>
            <PremiumHero eyebrow="Roommate split" title="Grocery and shared expense ledger" subtitle="Add hostel spends, split equally, and keep UPI reminders one tap away." icon="cash-multiple" />
            <SettlementList settlements={data.summary.settlements} apiFetch={apiFetch} residents={data.residents} />
          </>
        )}
        renderItem={({ item }) => <ExpenseCard expense={item} />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" message="No shared spends yet." />}
      />
      <ExpenseModal visible={showModal} onClose={() => setShowModal(false)} data={data} apiFetch={apiFetch} refresh={refresh} user={user} />
    </View>
  );
}

function BorrowView({ data, refresh, loading, apiFetch, user }) {
  const [itemName, setItemName] = useState('');
  const [otherUser, setOtherUser] = useState('');
  const [direction, setDirection] = useState('lent');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const firstOther = data.residents.find((resident) => resident.id !== user?.id);
    if (!otherUser && firstOther) setOtherUser(idOf(firstOther));
  }, [data.residents, otherUser, user?.id]);

  const saveBorrow = async () => {
    if (!itemName || !otherUser) return Alert.alert('Missing details', 'Item and hostler are required.');
    try {
      await apiFetch('/borrow', {
        method: 'POST',
        body: JSON.stringify({
          lenderId: direction === 'lent' ? user.id : otherUser,
          borrowerId: direction === 'lent' ? otherUser : user.id,
          itemName,
          notes,
          dueDate: null
        })
      });
      setItemName('');
      setNotes('');
      refresh();
    } catch (error) {
      Alert.alert('Borrow item not saved', error.message);
    }
  };

  const markReturned = async (id) => {
    try {
      await apiFetch(`/borrow/${id}/return`, { method: 'PATCH' });
      refresh();
    } catch (error) {
      Alert.alert('Return failed', error.message);
    }
  };

  return (
    <AppScroll loading={loading} refresh={refresh}>
      <Section title="Borrow / return tracker">
        <View style={styles.segment}>
          <TouchableOpacity style={[styles.segmentButton, direction === 'lent' && styles.segmentActive]} onPress={() => setDirection('lent')}>
            <Text style={[styles.segmentText, direction === 'lent' && styles.segmentTextActive]}>I gave</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentButton, direction === 'borrowed' && styles.segmentActive]} onPress={() => setDirection('borrowed')}>
            <Text style={[styles.segmentText, direction === 'borrowed' && styles.segmentTextActive]}>I borrowed</Text>
          </TouchableOpacity>
        </View>
        <LabeledInput label="Item" value={itemName} onChangeText={setItemName} placeholder="Charger, kettle, notes..." />
        <Text style={styles.label}>Hostler</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
          {data.residents.filter((resident) => resident.id !== user?.id).map((resident) => (
            <TouchableOpacity key={idOf(resident)} style={[styles.pill, otherUser === idOf(resident) && styles.pillActive]} onPress={() => setOtherUser(idOf(resident))}>
              <Text style={[styles.pillText, otherUser === idOf(resident) && styles.pillTextActive]}>{resident.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <LabeledInput label="Notes" value={notes} onChangeText={setNotes} placeholder="Return condition or reminder" />
        <TouchableOpacity style={styles.primaryButton} onPress={saveBorrow}>
          <Text style={styles.buttonText}>Save borrow entry</Text>
        </TouchableOpacity>
      </Section>
      <Section title="Borrow ledger">
        {data.borrows.map((item) => <BorrowCard key={idOf(item)} item={item} onReturn={markReturned} />)}
      </Section>
    </AppScroll>
  );
}

function LedgerView({ data, refresh, loading }) {
  return (
    <AppScroll loading={loading} refresh={refresh}>
      <PremiumHero eyebrow="Combined ledger" title="Chat, spend, mess, and borrow trail" subtitle="Every important hostel action is visible for management follow-up." icon="clipboard-list-outline" />
      <Section title="Split balances">
        <BalanceList balances={data.summary.balances} />
      </Section>
      <Section title="Borrow inventory">
        {data.borrows.map((item) => <BorrowCard key={idOf(item)} item={item} />)}
      </Section>
      <Section title="Chat ledger">
        <LedgerList messages={data.messages} />
      </Section>
    </AppScroll>
  );
}

function ChatLedger({ data, refresh, loading, apiFetch }) {
  const [message, setMessage] = useState('');
  const [ledgerTag, setLedgerTag] = useState('chat');

  const send = async () => {
    if (!message) return;
    try {
      await apiFetch('/messages', {
        method: 'POST',
        body: JSON.stringify({ message, ledgerTag })
      });
      setMessage('');
      refresh();
    } catch (error) {
      Alert.alert('Message failed', error.message);
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
        ListEmptyComponent={<EmptyState icon="chatbubbles-outline" message="No hostel messages yet." />}
      />
      <View style={styles.composer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
          {['chat', 'mess', 'expense', 'borrow'].map((tag) => (
            <TouchableOpacity key={tag} style={[styles.tagPill, ledgerTag === tag && styles.tagPillActive]} onPress={() => setLedgerTag(tag)}>
              <Text style={[styles.tagText, ledgerTag === tag && styles.tagTextActive]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.composerRow}>
          <TextInput style={styles.composerInput} value={message} onChangeText={setMessage} placeholder="Message + ledger note" placeholderTextColor={THEME.muted} />
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
    if (!description || !amount || !paidBy || !participants.length) return Alert.alert('Missing details', 'Description, amount, payer, and participants are required.');
    setSubmitting(true);
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({ description, amount, paidBy, participants, date: new Date().toISOString() })
      });
      setDescription('');
      setAmount('');
      onClose();
      refresh();
    } catch (error) {
      Alert.alert('Split not saved', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New split</Text>
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <Ionicons name="close" size={24} color={THEME.ink} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <LabeledInput label="Description" value={description} onChangeText={setDescription} placeholder="Shared groceries, Maggi stock, room cleaning" />
            <LabeledInput label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" />
            <Text style={styles.label}>Paid by</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {data.residents.map((resident) => (
                <TouchableOpacity key={idOf(resident)} style={[styles.pill, paidBy === idOf(resident) && styles.pillActive]} onPress={() => setPaidBy(idOf(resident))}>
                  <Text style={[styles.pillText, paidBy === idOf(resident) && styles.pillTextActive]}>{resident.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Split with</Text>
            <View style={styles.checkboxGrid}>
              {data.residents.map((resident) => (
                <TouchableOpacity key={idOf(resident)} style={[styles.checkbox, participants.includes(idOf(resident)) && styles.checkboxActive]} onPress={() => toggle(idOf(resident))}>
                  <Ionicons name={participants.includes(idOf(resident)) ? 'checkbox' : 'square-outline'} size={20} color={participants.includes(idOf(resident)) ? THEME.primary : THEME.muted} />
                  <Text style={[styles.checkboxLabel, participants.includes(idOf(resident)) && styles.checkboxLabelActive]}>{resident.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryButtonLarge} onPress={save} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonTextLarge}>Save and split equally</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AppScroll({ children, loading, refresh }) {
  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
      {children}
      <View style={{ height: 36 }} />
    </ScrollView>
  );
}

function PremiumHero({ eyebrow, title, subtitle, icon }) {
  return (
    <View style={styles.heroSection}>
      <View style={styles.heroTop}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name={icon} size={28} color={THEME.accent} />
        </View>
        <Text style={styles.heroEyebrow}>{eyebrow}</Text>
      </View>
      <Text style={styles.greeting}>{title}</Text>
      <Text style={styles.subGreeting}>{subtitle}</Text>
    </View>
  );
}

function MetricCard({ title, value, icon, color }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconBox, { backgroundColor: `${color}18` }]}>
        <MaterialCommunityIcons name={icon} size={23} color={color} />
      </View>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function LabeledInput({ label, compact, ...props }) {
  return (
    <View style={compact ? styles.compactInputWrap : null}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor={THEME.muted} />
    </View>
  );
}

function MenuCard({ menu }) {
  return (
    <View style={styles.menuCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.itemName}>{shortDate(menu.menuDate)}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Menu</Text>
        </View>
      </View>
      <MealLine icon="weather-sunny" label="Breakfast" value={menu.breakfast} />
      <MealLine icon="white-balance-sunny" label="Lunch" value={menu.lunch} />
      <MealLine icon="weather-night" label="Dinner" value={menu.dinner} />
      {menu.specialNote ? <Text style={styles.noticeText}>{menu.specialNote}</Text> : null}
    </View>
  );
}

function MealLine({ icon, label, value }) {
  return (
    <View style={styles.mealLine}>
      <MaterialCommunityIcons name={icon} size={18} color={THEME.accent} />
      <Text style={styles.mealLabel}>{label}</Text>
      <Text style={styles.mealValue}>{value}</Text>
    </View>
  );
}

function DueCard({ due }) {
  const total = Number(due.totalAmount || 0);
  const paid = Number(due.paidAmount || 0);
  const pending = Math.max(total - paid, 0);
  const color = due.status === 'paid' ? THEME.success : due.status === 'partial' ? THEME.warning : THEME.error;
  return (
    <View style={styles.dueCard}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.itemName}>{due.name}</Text>
          <Text style={styles.itemMeta}>{due.roomNo || 'Room'} | {due.billMonth} | {due.mealsCount} meals</Text>
        </View>
        <Text style={[styles.dueStatus, { color }]}>{due.status}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${total ? Math.min((paid / total) * 100, 100) : 0}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.itemMeta}>Paid {currency(paid)} | Pending {currency(pending)}</Text>
    </View>
  );
}

function ExpenseCard({ expense }) {
  const count = expense.participants?.length || 1;
  return (
    <View style={styles.cardItem}>
      <View style={[styles.iconCircle, { backgroundColor: `${THEME.primary}14` }]}>
        <Ionicons name="receipt-outline" size={20} color={THEME.primary} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemName}>{expense.description}</Text>
        <Text style={styles.itemMeta}>Paid by {expense.paidBy?.name || 'Hostler'} | split {count} ways | {shortDate(expense.date)}</Text>
      </View>
      <Text style={styles.itemPrice}>{currency(expense.amount)}</Text>
    </View>
  );
}

function BorrowCard({ item, onReturn }) {
  const active = item.status === 'borrowed';
  return (
    <View style={styles.cardItem}>
      <View style={[styles.iconCircle, { backgroundColor: active ? `${THEME.warning}16` : `${THEME.success}14` }]}>
        <Ionicons name={active ? 'time-outline' : 'checkmark-outline'} size={20} color={active ? THEME.warning : THEME.success} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemName}>{item.itemName}</Text>
        <Text style={styles.itemMeta}>{item.lenderName} to {item.borrowerName} | {item.notes || 'No notes'}</Text>
      </View>
      {active && onReturn ? (
        <TouchableOpacity style={styles.returnButton} onPress={() => onReturn(item.id)}>
          <Text style={styles.returnText}>Returned</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.dueStatus, { color: active ? THEME.warning : THEME.success }]}>{item.status}</Text>
      )}
    </View>
  );
}

function SettlementList({ settlements, apiFetch, residents }) {
  if (!settlements?.length) return <EmptyState icon="checkmark-circle-outline" message="Everything is settled." />;
  const remind = async (settlement) => {
    const target = residents?.find((resident) => resident.name === settlement.from);
    if (!apiFetch || !target) return;
    try {
      const result = await apiFetch('/reminders/upi', {
        method: 'POST',
        body: JSON.stringify({ toUserId: target.id, amount: settlement.amount, note: `Split payment to ${settlement.to}` })
      });
      Alert.alert('UPI reminder ready', result.message || 'Reminder queued.');
    } catch (error) {
      Alert.alert('Reminder failed', error.message);
    }
  };
  return settlements.map((settlement, index) => (
    <View key={`${settlement.from}-${settlement.to}-${index}`} style={styles.settlementItem}>
      <View style={styles.itemBody}>
        <Text style={styles.itemName}>{settlement.from} pays {settlement.to}</Text>
        <Text style={styles.itemMeta}>Suggested equal split settlement</Text>
      </View>
      <Text style={styles.itemPrice}>{currency(settlement.amount)}</Text>
      {apiFetch ? (
        <TouchableOpacity style={styles.remindButton} onPress={() => remind(settlement)}>
          <Ionicons name="notifications-outline" size={18} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </View>
  ));
}

function BalanceList({ balances }) {
  if (!balances?.length) return <EmptyState icon="scale-outline" message="No balances yet." />;
  return balances.map((item) => {
    const positive = Number(item.balance || 0) >= 0;
    return (
      <View key={item.userId} style={styles.balanceItem}>
        <Avatar name={item.name} small />
        <View style={styles.itemBody}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={[styles.itemMeta, { color: positive ? THEME.success : THEME.error }]}>{positive ? 'To receive' : 'To pay'}</Text>
        </View>
        <Text style={[styles.balanceValue, { color: positive ? THEME.success : THEME.error }]}>{currency(Math.abs(item.balance || 0))}</Text>
      </View>
    );
  });
}

function LedgerList({ messages }) {
  if (!messages?.length) return <EmptyState icon="chatbox-ellipses-outline" message="No ledger messages yet." />;
  return messages.map((item) => <MessageBubble key={idOf(item)} item={item} compact />);
}

function MessageBubble({ item, compact }) {
  return (
    <View style={[styles.messageBubble, compact && styles.messageCompact]}>
      <View style={styles.rowBetween}>
        <Text style={styles.messageName}>{item.name}</Text>
        <Text style={styles.messageTag}>{item.ledgerTag || 'chat'}</Text>
      </View>
      <Text style={styles.messageText}>{item.message}</Text>
      <Text style={styles.itemMeta}>{item.roomNo || 'Hostel'} | {shortDate(item.createdAt)}</Text>
    </View>
  );
}

function Insight({ title, value, detail }) {
  return (
    <View style={styles.insight}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.itemMeta}>{detail}</Text>
    </View>
  );
}

function Avatar({ name, small }) {
  return (
    <View style={small ? styles.avatarSmall : styles.avatar}>
      <Text style={small ? styles.avatarTextSmall : styles.avatarText}>{name?.charAt(0)?.toUpperCase() || 'H'}</Text>
    </View>
  );
}

function EmptyState({ icon, message }) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={42} color={THEME.border} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  flex1: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: THEME.background },
  content: { flex: 1 },
  authContainer: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: THEME.secondary },
  authPanel: { backgroundColor: THEME.surface, borderRadius: 8, padding: 24, borderWidth: 1, borderColor: '#ffffff33', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, elevation: 8 },
  brandMark: { width: 70, height: 70, borderRadius: 35, backgroundColor: THEME.secondary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  authTitle: { fontSize: 30, fontWeight: '900', color: THEME.ink, textAlign: 'center', letterSpacing: 0 },
  authSubtitle: { fontSize: 14, lineHeight: 21, color: THEME.muted, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  loginHint: { fontSize: 13, color: THEME.muted, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  loginHintBold: { fontSize: 13, color: THEME.ink, textAlign: 'center', fontWeight: '700' },
  header: { minHeight: 76, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: THEME.secondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0 },
  headerSub: { fontSize: 12, color: '#c9d7d2', marginTop: 2, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  rolePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#ffffff17', marginRight: 8 },
  rolePillText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  logoutIcon: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff17' },
  scrollView: { flex: 1, padding: 16 },
  tabBar: { flexDirection: 'row', backgroundColor: THEME.secondary, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 24 : 10, borderTopWidth: 1, borderTopColor: '#ffffff18' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  tabLabel: { color: '#d7dfdc', fontSize: 10, fontWeight: '700', marginTop: 4 },
  tabLabelActive: { color: THEME.accent },
  heroSection: { backgroundColor: THEME.secondary, borderRadius: 8, padding: 20, marginBottom: 18, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  heroIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#ffffff14', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  heroEyebrow: { color: THEME.accent, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0 },
  greeting: { color: '#fff', fontSize: 27, lineHeight: 33, fontWeight: '900', letterSpacing: 0 },
  subGreeting: { color: '#dce8e4', fontSize: 14, lineHeight: 21, marginTop: 8 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  metricCard: { width: '48%', backgroundColor: THEME.surface, borderRadius: 8, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: THEME.border, shadowColor: THEME.shadow, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  metricIconBox: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  metricValue: { fontSize: 20, fontWeight: '900', color: THEME.ink, letterSpacing: 0 },
  metricTitle: { fontSize: 12, color: THEME.muted, fontWeight: '800', marginTop: 3 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 19, fontWeight: '900', color: THEME.ink, marginBottom: 10, letterSpacing: 0 },
  sectionTitleSmall: { fontSize: 17, fontWeight: '900', color: THEME.ink, marginBottom: 8 },
  card: { backgroundColor: THEME.surface, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: THEME.border, shadowColor: THEME.shadow, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  formContainer: { backgroundColor: THEME.surface, padding: 16, borderBottomWidth: 1, borderBottomColor: THEME.border },
  listContent: { padding: 16, paddingBottom: 94 },
  label: { fontSize: 13, color: THEME.ink, fontWeight: '800', marginTop: 10, marginBottom: 7 },
  input: { backgroundColor: '#fbfaf7', borderWidth: 1, borderColor: THEME.border, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: THEME.ink },
  textArea: { minHeight: 92, textAlignVertical: 'top', marginBottom: 12 },
  compactInputWrap: { flex: 1 },
  twoColumn: { flexDirection: 'row', gap: 10 },
  passwordBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fbfaf7', borderWidth: 1, borderColor: THEME.border, borderRadius: 8 },
  passwordInput: { flex: 1, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: THEME.ink },
  iconButton: { padding: 10 },
  primaryButton: { backgroundColor: THEME.primary, borderRadius: 8, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryButtonLarge: { backgroundColor: THEME.primary, borderRadius: 8, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  roleButton: { backgroundColor: THEME.primary, borderRadius: 8, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  roleButtonSecondary: { backgroundColor: THEME.accent },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  buttonTextLarge: { color: '#fff', fontWeight: '900', fontSize: 16 },
  segment: { flexDirection: 'row', backgroundColor: THEME.soft, borderRadius: 8, padding: 4, marginBottom: 12 },
  segmentButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: THEME.surface },
  segmentText: { fontSize: 13, fontWeight: '800', color: THEME.muted },
  segmentTextActive: { color: THEME.primary },
  /* demo UI removed: Admin/Hostler demo buttons */
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemBody: { flex: 1, marginLeft: 12 },
  cardItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.surface, borderRadius: 8, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: THEME.border },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 15, color: THEME.ink, fontWeight: '900' },
  itemMeta: { fontSize: 12, color: THEME.muted, marginTop: 3, lineHeight: 17 },
  itemPrice: { fontSize: 15, color: THEME.ink, fontWeight: '900', marginLeft: 8 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: THEME.soft },
  statusText: { fontSize: 11, color: THEME.primary, fontWeight: '900', textTransform: 'capitalize' },
  menuCard: { padding: 12, borderRadius: 8, backgroundColor: '#fbfaf7', borderWidth: 1, borderColor: THEME.border, marginBottom: 10 },
  mealLine: { flexDirection: 'row', alignItems: 'center', marginTop: 11 },
  mealLabel: { width: 76, marginLeft: 8, fontSize: 12, fontWeight: '900', color: THEME.primary },
  mealValue: { flex: 1, fontSize: 13, color: THEME.ink, lineHeight: 18 },
  noticeText: { marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: `${THEME.accent}14`, color: THEME.warning, fontWeight: '700', fontSize: 12 },
  qrCard: { alignItems: 'center', padding: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: THEME.border, borderRadius: 8, backgroundColor: '#fbfaf7' },
  qrTitle: { fontSize: 18, fontWeight: '900', color: THEME.ink, marginTop: 8 },
  qrSub: { color: THEME.muted, marginTop: 4, fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  authActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  authActionButton: { flex: 1, marginHorizontal: 4 },
  smallAction: { flex: 1, borderRadius: 8, paddingVertical: 11, alignItems: 'center', backgroundColor: THEME.primary },
  smallActionText: { color: '#fff', fontWeight: '900', textTransform: 'capitalize', fontSize: 12 },
  ratingRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  commentItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.border },
  commentText: { marginTop: 6, color: THEME.ink, lineHeight: 19 },
  dueCard: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: THEME.border, marginBottom: 10, backgroundColor: '#fbfaf7' },
  dueStatus: { fontWeight: '900', textTransform: 'capitalize', fontSize: 12 },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: THEME.soft, overflow: 'hidden', marginTop: 12, marginBottom: 7 },
  progressFill: { height: 8, borderRadius: 8 },
  pillScroll: { marginBottom: 6 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: THEME.border, backgroundColor: '#fbfaf7', marginRight: 8 },
  pillActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  pillText: { color: THEME.muted, fontWeight: '800', fontSize: 13 },
  pillTextActive: { color: '#fff' },
  checkboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  checkbox: { flexDirection: 'row', alignItems: 'center', padding: 10, minWidth: '45%', borderRadius: 8, borderWidth: 1, borderColor: THEME.border, backgroundColor: '#fbfaf7' },
  checkboxActive: { borderColor: THEME.primary, backgroundColor: `${THEME.primary}10` },
  checkboxLabel: { marginLeft: 7, color: THEME.muted, fontWeight: '800', fontSize: 12 },
  checkboxLabelActive: { color: THEME.primary },
  fab: { position: 'absolute', right: 18, bottom: 84, zIndex: 5, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.accent, shadowColor: THEME.shadow, shadowOpacity: 1, shadowRadius: 12, elevation: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16, 41, 39, 0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: THEME.surface, borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 23, color: THEME.ink, fontWeight: '900' },
  settlementItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.border },
  remindButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.primary, marginLeft: 8 },
  balanceItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.border },
  balanceValue: { fontWeight: '900', fontSize: 15 },
  returnButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: THEME.success },
  returnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  chatList: { padding: 16, paddingBottom: 12 },
  composer: { backgroundColor: THEME.surface, borderTopWidth: 1, borderTopColor: THEME.border, padding: 12 },
  tagScroll: { marginBottom: 8 },
  tagPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: THEME.soft, marginRight: 7 },
  tagPillActive: { backgroundColor: THEME.primary },
  tagText: { color: THEME.muted, fontWeight: '900', fontSize: 12 },
  tagTextActive: { color: '#fff' },
  composerRow: { flexDirection: 'row', alignItems: 'center' },
  composerInput: { flex: 1, borderWidth: 1, borderColor: THEME.border, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 11, color: THEME.ink, backgroundColor: '#fbfaf7' },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.primary, marginLeft: 8 },
  messageBubble: { backgroundColor: THEME.surface, borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: THEME.border },
  messageCompact: { backgroundColor: '#fbfaf7' },
  messageName: { fontWeight: '900', color: THEME.ink, fontSize: 13 },
  messageTag: { color: THEME.accent, fontWeight: '900', fontSize: 11, textTransform: 'uppercase' },
  messageText: { color: THEME.ink, fontSize: 14, lineHeight: 20, marginTop: 6 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center' },
  avatarSmall: { width: 34, height: 34, borderRadius: 17, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 17 },
  avatarTextSmall: { color: '#fff', fontWeight: '900', fontSize: 13 },
  insightRow: { flexDirection: 'row', gap: 10 },
  insight: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#fbfaf7', borderWidth: 1, borderColor: THEME.border },
  emptyContainer: { padding: 28, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: THEME.muted, fontWeight: '700', fontSize: 13, marginTop: 10, textAlign: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff4f2', paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f1c5bf' },
  errorText: { color: THEME.error, fontWeight: '700', fontSize: 12, marginLeft: 7, flex: 1 },
  errorTitle: { color: THEME.ink, fontSize: 22, fontWeight: '900', marginTop: 16 },
  errorSubtitle: { color: THEME.muted, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 22 }
});
