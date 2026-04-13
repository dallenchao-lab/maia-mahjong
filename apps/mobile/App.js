import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { generateDeck } from '@maia-mahjong/engine';

export default function App() {
  const deck = generateDeck(true);
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Maia-Mahjong Mobile Component</Text>
      <Text style={styles.text}>Successfully Linked to @maia-mahjong/engine!</Text>
      <Text style={styles.text}>Deck Generation Physics Size: {deck.length}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10
  },
  text: {
    fontSize: 16,
    color: '#333'
  }
});
