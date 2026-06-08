import React, { useEffect, useState, useCallback, createContext, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://3.108.233.74/api';

const { width } = Dimensions.get('window');

const THEME = {
  primary: '#2457c5',
  secondary: '#1f3f83',
  accent: '#0f9f9a',
  background: '#f4f6f8',
  surface: '#ffffff',
  text: '#17202a',
  textSecondary: '#667085',
  success: '#168255',
  error: '#c2413a',
  warning: '#b7791f',
  border: '#d9dee7',
  shadow: 'rgba(18, 25, 38, 0.08)'
};

const currency = (amount) => `Rs. ${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// --- Auth Context ---
const AuthContext = createContext();

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
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
      } catch (e) {
        console.error('Failed to load auth', e);
      } finally {
        setLoading(false);
      }
    };
    loadAuth();
  }, []);

  const login = async (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    await AsyncStorage.setItem('token', newToken);
    await AsyncStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      <SafeAreaProvider>
        {token ? <MainScreen /> : <AuthNavigator />}
      </SafeAreaProvider>
    </AuthContext.Provider>
  );
}

// --- Auth Navigator ---
function AuthNavigator() {
  const [view, setView] = useState('login');
  return view === 'login' ? (
    <LoginScreen onSwitch={() => setView('signup')} onForgot={() => setView('forgot')} />
  ) : view === 'signup' ? (
    <SignupScreen onSwitch={() => setView('login')} />
  ) : view === 'forgot' ? (
    <ForgotPasswordScreen onBack={() => setView('login')} onReset={() => setView('reset')} />
  ) : (
    <ResetPasswordScreen onBack={() => setView('forgot')} />
  );
}

// --- Login Screen ---
function LoginScreen({ onSwitch, onForgot }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('rememberedEmail');
        const savedPassword = await AsyncStorage.getItem('rememberedPassword');
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
        if (savedPassword) setPassword(savedPassword);
      } catch (e) {
        console.error('Failed to load credentials', e);
      }
    };
    loadCredentials();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please fill all fields');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      if (rememberMe) {
        await AsyncStorage.setItem('rememberedEmail', email);
        await AsyncStorage.setItem('rememberedPassword', password);
      } else {
        await AsyncStorage.removeItem('rememberedEmail');
        await AsyncStorage.removeItem('rememberedPassword');
      }

      login(data.token, data.user);
    } catch (err) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.authContainer}>
      <View style={styles.authCard}>
        <View style={styles.logoCircle}>
          <MaterialCommunityIcons name="wallet" size={40} color={THEME.primary} />
        </View>
        <Text style={styles.authTitle}>Welcome Back</Text>
        <Text style={styles.authSubtitle}>Sign in to continue to LendStore</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="example@mail.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={THEME.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.rememberMeContainer}
          onPress={() => setRememberMe(!rememberMe)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={rememberMe ? "checkbox" : "square-outline"}
            size={20}
            color={rememberMe ? THEME.primary : THEME.textSecondary}
          />
          <Text style={styles.rememberMeText}>Remember Me</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onForgot} style={styles.linkButton}>
          <Text style={styles.linkText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButtonLarge} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonTextLarge}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={onSwitch} style={styles.switchButton}>
          <Text style={styles.switchText}>Don't have an account? <Text style={styles.switchHighlight}>Create Account</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// --- Forgot Password Screen ---
function ForgotPasswordScreen({ onBack, onReset }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSendReset = async () => {
    if (!email) return Alert.alert('Error', 'Please enter your email');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to send reset email');
      setMessage('If the email exists, reset instructions have been sent. Check your inbox.');
    } catch (err) {
      Alert.alert('Request Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.authContainer}>
      <View style={styles.authCard}>
        <View style={styles.logoCircle}>
          <MaterialCommunityIcons name="email" size={40} color={THEME.primary} />
        </View>
        <Text style={styles.authTitle}>Forgot Password</Text>
        <Text style={styles.authSubtitle}>Enter your email to receive reset instructions.</Text>

        {message ? <Text style={styles.successMessage}>{message}</Text> : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="example@mail.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <TouchableOpacity style={styles.primaryButtonLarge} onPress={handleSendReset} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonTextLarge}>Send Reset Email</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={onReset} style={styles.switchButton}>
          <Text style={styles.switchText}>Have a reset token? <Text style={styles.switchHighlight}>Reset Password</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onBack} style={styles.linkButton}>
          <Text style={styles.linkText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function ResetPasswordScreen({ onBack }) {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!token || !password || !confirmPassword) return Alert.alert('Error', 'Please fill all fields');
    if (password !== confirmPassword) return Alert.alert('Error', 'Passwords do not match');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reset failed');
      Alert.alert('Success', 'Password updated successfully. Please log in with your new password.');
      onBack();
    } catch (err) {
      Alert.alert('Reset Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.authContainer}>
      <View style={styles.authCard}>
        <View style={styles.logoCircle}>
          <Ionicons name="lock-closed" size={40} color={THEME.primary} />
        </View>
        <Text style={styles.authTitle}>Reset Password</Text>
        <Text style={styles.authSubtitle}>Enter the token from your email and set a new password.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Reset Token</Text>
          <TextInput
            style={styles.input}
            placeholder="Paste your reset token"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            placeholder="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.primaryButtonLarge} onPress={handleReset} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonTextLarge}>Reset Password</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={onBack} style={styles.linkButton}>
          <Text style={styles.linkText}>Back to forgot password</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// --- Signup Screen ---
function SignupScreen({ onSwitch }) {
  const { login } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password) return Alert.alert('Error', 'Please fill all fields');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      login(data.token, data.user);
    } catch (err) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.authContainer}>
      <View style={styles.authCard}>
        <View style={styles.logoCircle}>
          <MaterialCommunityIcons name="account-plus" size={40} color={THEME.primary} />
        </View>
        <Text style={styles.authTitle}>Create Account</Text>
        <Text style={styles.authSubtitle}>Start tracking your shared spends</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} placeholder="John Doe" value={name} onChangeText={setName} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="example@mail.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={THEME.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButtonLarge} onPress={handleSignup} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonTextLarge}>Sign Up</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={onSwitch} style={styles.switchButton}>
          <Text style={styles.switchText}>Already have an account? <Text style={styles.switchHighlight}>Log In</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// --- Main App Logic ---
function MainScreen() {
  const { logout, user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    users: [],
    expenses: [],
    bills: [],
    summary: { balances: [], settlements: [] }
  });
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchJson = async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = await res.json();
        return json;
      };

      const [users, expenses, bills, summary] = await Promise.all([
        fetchJson(`${API_URL}/users`),
        fetchJson(`${API_URL}/expenses`),
        fetchJson(`${API_URL}/bills`),
        fetchJson(`${API_URL}/summary`)
      ]);

      setData({
        users: Array.isArray(users) ? users : [],
        expenses: Array.isArray(expenses) ? expenses : [],
        bills: Array.isArray(bills) ? bills : [],
        summary: {
          balances: Array.isArray(summary?.balances) ? summary.balances : [],
          settlements: Array.isArray(summary?.settlements) ? summary.settlements : []
        }
      });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderContent = () => {
    // If we have an error and no data yet, show error view instead of breaking
    if (error && data.users.length === 0 && data.expenses.length === 0) {
      return (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={64} color={THEME.textSecondary} />
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={fetchData}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard data={data} refresh={fetchData} loading={loading} user={user} logout={logout} />;
      case 'users':
        return <Users data={data} refresh={fetchData} loading={loading} />;
      case 'expenses':
        return <Expenses data={data} refresh={fetchData} loading={loading} />;
      case 'bills':
        return <Bills data={data} refresh={fetchData} loading={loading} />;
      case 'balances':
        return <Balances data={data} refresh={fetchData} loading={loading} />;
      default:
        return <Dashboard data={data} refresh={fetchData} loading={loading} user={user} logout={logout} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.surface} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LendStore</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerUser}>{user?.name || 'User'}</Text>
          <TouchableOpacity onPress={logout} style={styles.logoutIcon}>
            <Ionicons name="log-out-outline" size={24} color={THEME.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>

      <View style={styles.tabBar}>
        <TabItem label="Home" icon="home-outline" activeIcon="home" active={activeTab === 'dashboard'} onPress={() => setActiveTab('dashboard')} />
        <TabItem label="Balances" icon="pie-chart-outline" activeIcon="pie-chart" active={activeTab === 'balances'} onPress={() => setActiveTab('balances')} />
        <TabItem label="Spends" icon="wallet-outline" activeIcon="wallet" active={activeTab === 'expenses'} onPress={() => setActiveTab('expenses')} />
        <TabItem label="Bills" icon="calendar-outline" activeIcon="calendar" active={activeTab === 'bills'} onPress={() => setActiveTab('bills')} />
        <TabItem label="Users" icon="people-outline" activeIcon="people" active={activeTab === 'users'} onPress={() => setActiveTab('users')} />
      </View>
    </SafeAreaView>
  );
}

function TabItem({ label, icon, activeIcon, active, onPress }) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress}>
      <Ionicons
        name={active ? activeIcon : icon}
        size={24}
        color={active ? THEME.primary : THEME.textSecondary}
      />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Dashboard({ data, refresh, loading, user, logout }) {
  const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <View style={styles.heroSection}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'User'}</Text>
          <Text style={styles.subGreeting}>Track shared spending, bills, and balances</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <MetricCard title="Users" value={data.users?.length || 0} icon="account-group" color={THEME.primary} />
        <MetricCard title="Total Spends" value={data.expenses?.length || 0} icon="cash-multiple" color={THEME.success} />
        <MetricCard title="Active Bills" value={data.bills?.length || 0} icon="file-document-outline" color={THEME.warning} />
        <MetricCard title="Balances" value={data.summary?.balances?.length || 0} icon="scale-balance" color={THEME.accent} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
      </View>

      <View style={styles.card}>
        {recentExpenses.length > 0 ? (
          recentExpenses.map((expense, index) => (
            <View key={expense._id || index} style={[styles.recentItem, index === recentExpenses.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.iconCircle}>
                <Ionicons name="cart-outline" size={20} color={THEME.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.recentItemName} numberOfLines={1}>{expense.description}</Text>
                <Text style={styles.recentItemMeta}>
                  {expense.paidBy?.name} | {new Date(expense.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text style={styles.recentItemAmount}>{currency(expense.amount)}</Text>
            </View>
          ))
        ) : (
          <EmptyState icon="receipt-outline" message="No recent activity yet." />
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MetricCard({ title, value, icon, color }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconBox, { backgroundColor: color + '15' }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );
}

function EmptyState({ icon, message }) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={48} color={THEME.border} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function Users({ data, refresh, loading }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addUser = async () => {
    if (!name) return Alert.alert('Error', 'Name is required');
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      if (!res.ok) throw new Error('Failed to add user');
      setName('');
      setEmail('');
      refresh();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteUser = (id) => {
    Alert.alert('Delete User', 'Are you sure you want to remove this user?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Failed to delete');
          }
          refresh();
        } catch (err) {
          Alert.alert('Error', err.message);
        }
      }}
    ]);
  };

  return (
    <View style={styles.flex1}>
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitleSmall}>Add New User</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="Name"
            value={name}
            onChangeText={setName}
            placeholderTextColor={THEME.textSecondary}
          />
          <TextInput
            style={[styles.input, { flex: 1.5 }]}
            placeholder="Email (Optional)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholderTextColor={THEME.textSecondary}
          />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={addUser} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create User</Text>}
        </TouchableOpacity>
      </View>

      <FlatList
        data={data.users || []}
        keyExtractor={(item) => item._id || Math.random().toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshing={loading}
        onRefresh={refresh}
        renderItem={({ item }) => (
          <View style={styles.cardItem}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name?.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.email || 'No email provided'}</Text>
            </View>
            <TouchableOpacity onPress={() => deleteUser(item._id)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={20} color={THEME.error} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="people-outline" message="No users added yet." />}
      />
    </View>
  );
}

function Expenses({ data, refresh, loading }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [participants, setParticipants] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (data.users?.length > 0 && !paidBy) {
      setPaidBy(data.users[0]._id);
      setParticipants(data.users.map(u => u._id));
    }
  }, [data.users]);

  const addExpense = async () => {
    if (!description || !amount || !paidBy || participants.length === 0) {
      return Alert.alert('Error', 'Please fill all fields and select participants');
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, amount, paidBy, participants, date: new Date().toISOString() })
      });
      if (!res.ok) throw new Error('Failed to add spend');
      setDescription('');
      setAmount('');
      setShowModal(false);
      refresh();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteExpense = (id) => {
    Alert.alert('Delete Spend', 'Remove this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await fetch(`${API_URL}/expenses/${id}`, { method: 'DELETE' });
          refresh();
        } catch (err) {
          Alert.alert('Error', err.message);
        }
      }}
    ]);
  };

  const toggleParticipant = (id) => {
    if (participants.includes(id)) {
      setParticipants(participants.filter(p => p !== id));
    } else {
      setParticipants([...participants, id]);
    }
  };

  return (
    <View style={styles.flex1}>
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Spend</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeIcon}>
                <Ionicons name="close" size={24} color={THEME.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} placeholder="e.g. Dinner, Rent" value={description} onChangeText={setDescription} />

              <Text style={styles.label}>Amount</Text>
              <TextInput style={styles.input} placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="numeric" />

              <Text style={styles.label}>Paid By</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                {(data.users || []).map(user => (
                  <TouchableOpacity
                    key={user._id}
                    style={[styles.pill, paidBy === user._id && styles.pillActive]}
                    onPress={() => setPaidBy(user._id)}
                  >
                    <Text style={[styles.pillText, paidBy === user._id && styles.pillTextActive]}>{user.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Split with</Text>
              <View style={styles.checkboxGrid}>
                {(data.users || []).map(user => (
                  <TouchableOpacity
                    key={user._id}
                    style={[styles.checkbox, participants.includes(user._id) && styles.checkboxActive]}
                    onPress={() => toggleParticipant(user._id)}
                  >
                    <Ionicons
                      name={participants.includes(user._id) ? "checkbox" : "square-outline"}
                      size={20}
                      color={participants.includes(user._id) ? THEME.primary : THEME.textSecondary}
                    />
                    <Text style={[styles.checkboxLabel, participants.includes(user._id) && styles.checkboxLabelActive]}>{user.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.primaryButtonLarge} onPress={addExpense} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonTextLarge}>Save Transaction</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FlatList
        data={data.expenses || []}
        keyExtractor={(item) => item._id || Math.random().toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshing={loading}
        onRefresh={refresh}
        renderItem={({ item }) => (
          <View style={styles.cardItem}>
            <View style={[styles.iconCircle, { backgroundColor: THEME.primary + '10' }]}>
              <Ionicons name="receipt-outline" size={20} color={THEME.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.itemName}>{item.description}</Text>
              <Text style={styles.itemMeta}>
                Paid by {item.paidBy?.name} | {new Date(item.date).toLocaleDateString()}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.itemPrice}>{currency(item.amount)}</Text>
              <TouchableOpacity onPress={() => deleteExpense(item._id)} style={{ marginTop: 4 }}>
                <Ionicons name="trash-outline" size={16} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="cash-outline" message="No transactions recorded." />}
      />
    </View>
  );
}

function Bills({ data, refresh, loading }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const addBill = async () => {
    if (!name || !amount || !dueDay || !email) {
      return Alert.alert('Error', 'Please fill required fields');
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, amount, dueDay, notifyEmail: email, notes })
      });
      if (!res.ok) throw new Error('Failed to add bill');
      setName('');
      setAmount('');
      setDueDay('');
      setEmail('');
      setNotes('');
      setShowModal(false);
      refresh();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBill = (id) => {
    Alert.alert('Delete Bill', 'Stop tracking this bill?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await fetch(`${API_URL}/bills/${id}`, { method: 'DELETE' });
          refresh();
        } catch (err) {
          Alert.alert('Error', err.message);
        }
      }}
    ]);
  };

  const runReminders = async () => {
    try {
      const res = await fetch(`${API_URL}/reminders/run`, { method: 'POST' });
      const result = await res.json();
      Alert.alert('Reminders', result.sent?.length > 0 ? `Sent ${result.sent.length} reminders for today.` : 'No bills are due today.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.flex1}>
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Track Bill</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeIcon}>
                <Ionicons name="close" size={24} color={THEME.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Bill Name</Text>
              <TextInput style={styles.input} placeholder="e.g. Netflix, Electricity" value={name} onChangeText={setName} />

              <Text style={styles.label}>Monthly Amount</Text>
              <TextInput style={styles.input} placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="numeric" />

              <Text style={styles.label}>Due Day of Month</Text>
              <TextInput style={styles.input} placeholder="1-31" value={dueDay} onChangeText={setDueDay} keyboardType="numeric" maxLength={2} />

              <Text style={styles.label}>Notification Email</Text>
              <TextInput style={styles.input} placeholder="email@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" />

              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Add details..." value={notes} onChangeText={setNotes} multiline />

              <TouchableOpacity style={styles.primaryButtonLarge} onPress={addBill} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonTextLarge}>Start Tracking</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.actionsHeader}>
        <TouchableOpacity style={styles.outlineButton} onPress={runReminders}>
          <Ionicons name="notifications-outline" size={18} color={THEME.primary} style={{ marginRight: 6 }} />
          <Text style={styles.outlineButtonText}>Run Reminder Check</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data.bills || []}
        keyExtractor={(item) => item._id || Math.random().toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshing={loading}
        onRefresh={refresh}
        renderItem={({ item }) => (
          <View style={styles.cardItem}>
            <View style={[styles.iconCircle, { backgroundColor: THEME.warning + '10' }]}>
              <Ionicons name="calendar-outline" size={20} color={THEME.warning} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                Due on day {item.dueDay} | {item.notifyEmail}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.itemPrice}>{currency(item.amount)}</Text>
              <TouchableOpacity onPress={() => deleteBill(item._id)} style={{ marginTop: 4 }}>
                <Ionicons name="trash-outline" size={16} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="document-text-outline" message="No bills tracked yet." />}
      />
    </View>
  );
}

function Balances({ data, refresh, loading }) {
  const balances = data.summary?.balances || [];
  const settlements = data.summary?.settlements || [];

  return (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Settled Status</Text>
        <Text style={styles.summaryMain}>{settlements.length === 0 ? "All clear" : "Pending settlements"}</Text>
      </View>

      <Text style={styles.sectionTitle}>Individual Balances</Text>
      <View style={styles.card}>
        {balances.length > 0 ? balances.map((item, index) => (
          <View key={item.userId || index} style={[styles.balanceItem, index === balances.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarTextSmall}>{item.name?.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={[styles.itemMeta, { color: (item.balance || 0) >= 0 ? THEME.success : THEME.error }]}>
                {(item.balance || 0) >= 0 ? 'To receive' : 'To pay'}
              </Text>
            </View>
            <Text style={[styles.balanceValue, { color: (item.balance || 0) >= 0 ? THEME.success : THEME.error }]}>
              {currency(Math.abs(item.balance || 0))}
            </Text>
          </View>
        )) : <EmptyState icon="scale-outline" message="No balances yet." />}
      </View>

      <Text style={styles.sectionTitle}>Suggested Settlements</Text>
      <View style={styles.card}>
        {settlements.length > 0 ? (
          settlements.map((s, i) => (
            <View key={i} style={[styles.recentItem, i === settlements.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.iconCircle, { backgroundColor: THEME.accent + '10' }]}>
                <Ionicons name="swap-horizontal" size={20} color={THEME.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.settlementText}>
                  <Text style={styles.boldText}>{s.from}</Text> to <Text style={styles.boldText}>{s.to}</Text>
                </Text>
              </View>
              <Text style={styles.recentItemAmount}>{currency(s.amount)}</Text>
            </View>
          ))
        ) : (
          <EmptyState icon="checkmark-circle-outline" message="Everything is settled." />
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  flex1: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: THEME.primary, letterSpacing: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerUser: { fontSize: 14, color: THEME.textSecondary, fontWeight: '700', marginRight: 12 },
  logoutIcon: { padding: 8, borderRadius: 8, backgroundColor: THEME.error + '10' },
  content: { flex: 1 },
  scrollView: { flex: 1, padding: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  errorTitle: { fontSize: 22, fontWeight: '800', color: THEME.text, marginTop: 24 },
  errorSubtitle: { fontSize: 14, color: THEME.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 32 },

  // Auth Styles
  authContainer: { flex: 1, backgroundColor: THEME.background, justifyContent: 'center', padding: 20 },
  authCard: { backgroundColor: THEME.surface, borderRadius: 8, padding: 28, elevation: 4, shadowColor: THEME.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, borderWidth: 1, borderColor: THEME.border },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: THEME.primary + '10', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 24 },
  authTitle: { fontSize: 28, fontWeight: '800', color: THEME.text, textAlign: 'center', marginBottom: 8 },
  authSubtitle: { fontSize: 15, color: THEME.textSecondary, textAlign: 'center', marginBottom: 32 },
  inputGroup: { marginBottom: 20 },
  switchButton: { marginTop: 24, alignItems: 'center' },
  switchText: { fontSize: 14, color: THEME.textSecondary },
  switchHighlight: { color: THEME.primary, fontWeight: '700' },
  logoutBtn: { padding: 8, borderRadius: 8, backgroundColor: THEME.error + '10' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, color: THEME.textSecondary, marginTop: 4, fontWeight: '500' },
  tabLabelActive: { color: THEME.primary, fontWeight: '700' },

  errorBanner: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, margin: 16, borderRadius: 8, alignItems: 'center', borderLeftWidth: 4, borderLeftColor: THEME.error, elevation: 2 },
  errorText: { color: THEME.error, fontSize: 13, marginLeft: 8, fontWeight: '500' },

  heroSection: { marginBottom: 20 },
  greeting: { fontSize: 26, fontWeight: '800', color: THEME.text, letterSpacing: 0 },
  subGreeting: { fontSize: 15, color: THEME.textSecondary, marginTop: 4 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  metricCard: {
    width: '48%',
    backgroundColor: THEME.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12
  },
  metricIconBox: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  metricTitle: { fontSize: 12, color: THEME.textSecondary, fontWeight: '600' },
  metricValue: { fontSize: 22, fontWeight: '800', color: THEME.text, marginBottom: 2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: THEME.text, letterSpacing: 0 },
  sectionTitleSmall: { fontSize: 16, fontWeight: '700', color: THEME.text, marginBottom: 12 },

  card: { backgroundColor: THEME.surface, borderRadius: 8, padding: 8, elevation: 2, shadowColor: THEME.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, borderWidth: 1, borderColor: THEME.border },
  recentItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: THEME.border },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.background, alignItems: 'center', justifyContent: 'center' },
  recentItemName: { fontSize: 15, fontWeight: '600', color: THEME.text },
  recentItemMeta: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  recentItemAmount: { fontSize: 16, fontWeight: '700', color: THEME.text },

  cardItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: THEME.surface, borderRadius: 8, marginBottom: 12, elevation: 2, shadowColor: THEME.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, borderWidth: 1, borderColor: THEME.border },
  itemName: { fontSize: 16, fontWeight: '700', color: THEME.text },
  itemMeta: { fontSize: 13, color: THEME.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: 16, fontWeight: '800', color: THEME.text },

  formContainer: { padding: 20, backgroundColor: THEME.surface, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, elevation: 4, shadowColor: THEME.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, borderBottomWidth: 1, borderColor: THEME.border },
  row: { flexDirection: 'row', marginBottom: 12 },
  input: { backgroundColor: THEME.surface, borderRadius: 8, padding: 14, fontSize: 15, color: THEME.text, borderWidth: 1, borderColor: THEME.border },
  label: { fontSize: 14, fontWeight: '700', color: THEME.text, marginTop: 16, marginBottom: 8, marginLeft: 4 },

  primaryButton: { backgroundColor: THEME.primary, padding: 14, borderRadius: 8, alignItems: 'center', elevation: 3 },
  primaryButtonLarge: { backgroundColor: THEME.primary, padding: 18, borderRadius: 8, alignItems: 'center', marginTop: 24, elevation: 4 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  buttonTextLarge: { color: '#fff', fontWeight: '800', fontSize: 17 },

  outlineButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: THEME.primary, backgroundColor: THEME.surface },
  outlineButtonText: { color: THEME.primary, fontWeight: '600', fontSize: 14 },
  actionsHeader: { paddingHorizontal: 20, marginTop: 8 },

  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.accent, alignItems: 'center', justifyContent: 'center' },
  avatarTextSmall: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  deleteBtn: { padding: 8 },

  fab: { position: 'absolute', bottom: 20, right: 20, width: 64, height: 64, borderRadius: 32, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: THEME.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, zIndex: 99 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: THEME.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12, height: '85%', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: THEME.text },
  closeIcon: { padding: 4 },
  modalScroll: { flex: 1 },

  pillScroll: { flexDirection: 'row', marginBottom: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: THEME.border, marginRight: 8, backgroundColor: THEME.surface },
  pillActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  pillText: { fontSize: 14, color: THEME.textSecondary, fontWeight: '600' },
  pillTextActive: { color: '#fff' },

  checkboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkbox: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: THEME.border, minWidth: '30%' },
  checkboxActive: { borderColor: THEME.primary, backgroundColor: THEME.primary + '08' },
  checkboxLabel: { fontSize: 14, color: THEME.textSecondary, marginLeft: 8, fontWeight: '500' },
  checkboxLabelActive: { color: THEME.primary, fontWeight: '700' },

  summaryCard: { backgroundColor: THEME.secondary, borderRadius: 8, padding: 24, marginBottom: 24, elevation: 4, shadowColor: THEME.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 12 },
  summaryLabel: { color: '#fff', opacity: 0.8, fontSize: 14, fontWeight: '600' },
  summaryMain: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },

  balanceItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: THEME.border },
  balanceValue: { fontSize: 18, fontWeight: '800' },
  settlementText: { fontSize: 15, color: THEME.text, lineHeight: 22 },
  boldText: { fontWeight: '700' },

  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: THEME.textSecondary, marginTop: 12, fontSize: 14, fontWeight: '500' },
  rememberMeContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginLeft: 4 },
  rememberMeText: { fontSize: 14, color: THEME.text, marginLeft: 8, fontWeight: '500' },
  linkButton: { alignSelf: 'flex-start', marginTop: 14 },
  linkText: { color: THEME.primary, fontWeight: '700' },
  successMessage: { color: THEME.success, fontSize: 14, marginBottom: 12, textAlign: 'center' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.surface, borderRadius: 8, borderWidth: 1, borderColor: THEME.border },
  passwordInput: { flex: 1, padding: 14, fontSize: 15, color: THEME.text },
  eyeIcon: { paddingHorizontal: 12 }
});
