// AsyncStorage n'a pas de module natif sous Jest : on utilise le mock fourni par la lib
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
