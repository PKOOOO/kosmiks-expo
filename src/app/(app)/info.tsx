import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Linking, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/components/Header';
import SideMenu from '@/components/SideMenu';

const darkBrown = "#423120";
const lightBrown = "#D7C3A7";
const veryLightBeige = "#F4EDE5";
const white = "#FFFFFF";

type TabType = 'faq' | 'about' | 'contact' | 'terms' | 'privacy';

export default function InfoPage() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>('faq');
    const [isMenuVisible, setMenuVisible] = useState(false);

    useEffect(() => {
        if (params.tab) {
            setActiveTab(params.tab as TabType);
        }
    }, [params.tab]);

    const tabs: { key: TabType; label: string }[] = [
        { key: 'faq', label: 'FAQ' },
        { key: 'about', label: 'Tietoja meistä' },
        { key: 'contact', label: 'Ota yhteyttä' },
        { key: 'terms', label: 'Ehdot' },
        { key: 'privacy', label: 'Yksityisyys' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'faq':
                return (
                    <View>
                        <Text style={styles.sectionTitle}>Usein kysytyt kysymykset</Text>

                        <View style={styles.faqItem}>
                            <Text style={styles.question}>Miten voin varata palvelun?</Text>
                            <Text style={styles.answer}>Voit varata palvelun siirtymällä Palvelut-sivulle, valitsemalla kategorian, valitsemalla palvelun ja valitsemalla ajankohdan.</Text>
                        </View>

                        <View style={styles.faqItem}>
                            <Text style={styles.question}>Voinko peruuttaa varaukseni?</Text>
                            <Text style={styles.answer}>Kyllä, voit peruuttaa varauksesi profiilisi "Omat varaukset" -osiossa peruutusehtojen mukaisesti.</Text>
                        </View>

                        <View style={styles.faqItem}>
                            <Text style={styles.question}>Mitä maksutapoja hyväksytään?</Text>
                            <Text style={styles.answer}>Hyväksymme yleisimmät luottokortit ja verkkopankkimaksut Paytrailin kautta.</Text>
                        </View>
                    </View>
                );
            case 'about':
                return (
                    <View>
                        <Text style={styles.sectionTitle}>Tietoja meistä</Text>
                        <Text style={styles.paragraph}>
                            SERVEY on ensisijainen kauneus- ja hyvinvointipalveluiden kohteesi. Yhdistämme sinut huippuammattilaisiin hiusten, kynsien, hieronnan ja muiden alojen parissa.
                        </Text>
                        <Text style={styles.paragraph}>
                            Missiomme on tehdä itsehoidosta helppoa ja helppoa kaikille. Tarvitsetpa sitten nopeaa siistimistä tai kokonaisen kylpyläpäivän, me hoidamme kaiken.
                        </Text>
                    </View>
                );
            case 'contact':
                return (
                    <View>
                        <Text style={styles.sectionTitle}>Ota yhteyttä</Text>
                        <Text style={styles.paragraph}>
                            Onko sinulla kysyttävää tai palautetta? Kuulemme mielellämme sinusta!
                        </Text>

                        <View style={styles.contactItem}>
                            <Ionicons name="mail-outline" size={24} color={darkBrown} />
                            <Text style={styles.contactText}>support@servey.com</Text>
                        </View>

                        <View style={styles.contactItem}>
                            <Ionicons name="call-outline" size={24} color={darkBrown} />
                            <Text style={styles.contactText}>+358 40 123 4567</Text>
                        </View>

                        <View style={styles.contactItem}>
                            <Ionicons name="location-outline" size={24} color={darkBrown} />
                            <Text style={styles.contactText}>Helsinki, Finland</Text>
                        </View>
                    </View>
                );
            case 'terms':
                return (
                    <View>
                        <Text style={styles.sectionTitle}>Käyttöehdot</Text>
                        <Text style={styles.paragraph}>
                            Tervetuloa SERVEYiin. Käyttämällä sovellustamme hyväksyt nämä ehdot.
                        </Text>
                        <Text style={styles.subTitle}>1. Käyttäjätilit</Text>
                        <Text style={styles.paragraph}>
                            Olet vastuussa Google-/Apple-tilisi luottamuksellisuuden säilyttämisestä.
                        </Text>
                        <Text style={styles.subTitle}>2. Varaukset</Text>
                        <Text style={styles.paragraph}>
                            Varaukset riippuvat saatavuudesta ja palveluntarjoajan vahvistuksesta.
                        </Text>
                        <Text style={styles.subTitle}>3. Peruutukset</Text>
                        <Text style={styles.paragraph}>
                            Peruutukset on tehtävä vähintään 24 tuntia etukäteen maksujen välttämiseksi.
                        </Text>
                    </View>
                );
            case 'privacy':
                return (
                    <View>
                        <Text style={styles.sectionTitle}>Tietosuojalausunto</Text>
                        <Text style={styles.paragraph}>
                            Tietosuojasi on meille tärkeää. Tässä käytännössä selitetään, miten keräämme ja käytämme tietojasi.
                        </Text>
                        <Text style={styles.subTitle}>Tiedonkeruu</Text>
                        <Text style={styles.paragraph}>
                            Keräämme tietoja, jotka annat meille suoraan, esimerkiksi luodessasi tilin tai varatessasi palvelun.
                        </Text>
                        <Text style={styles.subTitle}>Datan käyttö</Text>
                        <Text style={styles.paragraph}>
                            Käytämme tietojasi palvelujemme tarjoamiseen ja parantamiseen, maksujen käsittelyyn ja viestintään kanssasi.
                        </Text>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: white }}>
            <Header
                showBack={true}
                onBackPress={() => router.back()}
                showMenu={true}
                onMenuPress={() => setMenuVisible(true)}
                disableSafeAreaPadding={true}
            />

            {/* Side menu modal */}
            <Modal
                visible={isMenuVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setMenuVisible(false)}
                statusBarTranslucent={true}
            >
                <SideMenu onClose={() => setMenuVisible(false)} />
            </Modal>

            <View style={{ height: 70, backgroundColor: white, paddingVertical: 10 }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center', height: 50 }}
                >
                    {tabs.map((tab) => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key)}
                            activeOpacity={0.8}
                            style={{
                                paddingVertical: 10,
                                paddingHorizontal: 20,
                                marginRight: 10,
                                borderRadius: 25,
                                backgroundColor: activeTab === tab.key ? lightBrown : white,
                                borderWidth: 2,
                                borderColor: activeTab === tab.key ? lightBrown : darkBrown,
                                height: 45,
                                justifyContent: 'center',
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.1,
                                shadowRadius: 2,
                                elevation: 2,
                            }}
                        >
                            <Text style={{
                                color: darkBrown,
                                fontFamily: 'Philosopher-Bold',
                                fontSize: 15
                            }}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView style={{ flex: 1, padding: 20 }}>
                {renderContent()}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = {
    sectionTitle: {
        fontSize: 24,
        fontFamily: 'Philosopher-Bold',
        color: darkBrown,
        marginBottom: 20,
    },
    subTitle: {
        fontSize: 18,
        fontFamily: 'Philosopher-Bold',
        color: darkBrown,
        marginTop: 16,
        marginBottom: 8,
    },
    paragraph: {
        fontSize: 18,
        fontFamily: 'Philosopher-Regular',
        color: darkBrown,
        lineHeight: 24,
        marginBottom: 12,
    },
    faqItem: {
        marginBottom: 20,
        backgroundColor: veryLightBeige,
        padding: 16,
        borderRadius: 12,
    },
    question: {
        fontSize: 18,
        fontFamily: 'Philosopher-Bold',
        color: darkBrown,
        marginBottom: 8,
    },
    answer: {
        fontSize: 18,
        fontFamily: 'Philosopher-Regular',
        color: darkBrown,
        lineHeight: 22,
    },
    contactItem: {
        flexDirection: 'row' as 'row',
        alignItems: 'center' as 'center',
        marginBottom: 16,
        backgroundColor: veryLightBeige,
        padding: 16,
        borderRadius: 12,
    },
    contactText: {
        marginLeft: 12,
        fontSize: 18,
        fontFamily: 'Philosopher-Regular',
        color: darkBrown,
    },
};
