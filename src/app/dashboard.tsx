
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const recentCalls = [
  { id: '1', name: 'Rahul Sharma', number: '+91 98765 43210', status: 'Interested' },
  { id: '2', name: 'Priya Mehta', number: '+91 91234 56789', status: 'No Answer' },
  { id: '3', name: 'Amit Verma', number: '+91 99887 66554', status: 'Follow-up' },
];

function Dashboard() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.header}>Dashboard</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>24</Text>
            <Text style={styles.statLabel}>Leads Assigned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>15</Text>
            <Text style={styles.statLabel}>Calls Made</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>6</Text>
            <Text style={styles.statLabel}>follow-ups Due</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>63%</Text>
            <Text style={styles.statLabel}>Connection Rate</Text>
          </View>
          <Text style={styles.sectionTitle}>Recent Calls</Text>

          {recentCalls.map((call) => (
            <View key={call.id} style={styles.callRow}>
              <View>
                <Text style={styles.callName}>{call.name}</Text>
                <Text style={styles.callNumber}>{call.number}</Text>
              </View>
              <Text style={styles.callStatus}>{call.status}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  header: { fontSize: 24, fontWeight: '700', margin: 16, color: '#1A1A1A' },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    margin: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2E5CFF',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    margin: 16,
    marginBottom: 8,
    color: '#1A1A1A',
  },
  callRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  callName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  callNumber: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  callStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E5CFF',
  },
});
export default Dashboard