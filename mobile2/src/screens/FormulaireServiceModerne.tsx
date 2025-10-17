// FormulaireServiceModerne.tsx - Page moderne pour créer des services
import AppLayout from '@/components/layout/AppLayout';
import { creerService, vectoriserService } from '@/lib/yukpoaclient';
import { ROUTES } from '@/routes/AppRoutesRegistry';
import { ComposantFrontend, dispatchChampsFormulaireIA } from '@/utils/form_constraint_dispatcher';
import * as React from "react";
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useLocation, useNavigation } from 'react-router-dom';

// Mantine imports
import { showServiceCreationErrorToast, showSimpleServiceCreationToast } from '@/utils/toastUtils';
import { Badge, Card, Grid, Group, SimpleGrid, Skeleton, Stack, Stepper, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
// import { toast } from 'react-hot-toast'; // Removed - not available in React Native

const FormulaireServiceModerne: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigation();
  const { user } = useAuth();
  const suggestion = location.state?.suggestion || {};
  const { confidence, tokens_consumed } = suggestion;

  const [activeStep, setActiveStep] = useState(1);
  const [composants, setComposants] = useState<ComposantFrontend[]>([]);
  const [loading, setLoading] = useState(false);

  // Mantine form initialisé avec les données pré-remplies
  const form = useForm({ initialValues: suggestion.data || {} });

  useEffect(() => {
    if (suggestion && suggestion.data) {
      setComposants(dispatchChampsFormulaireIA(suggestion));
    }
  }, [suggestion]);

  const handleSaveService = async (values: any) => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }
    setLoading(true);
    try {
      await creerService({ intention: suggestion.intention || 'creation_service', data: values });

      // Note: window.dispatchEvent et CustomEvent n'existent pas en React Native
      // Dans React Native, on utiliserait un système d'événements ou context

      showSimpleServiceCreationToast();
      navigation.navigate(ROUTES.MES_SERVICES);
    } catch (e: any) {
      showServiceCreationErrorToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVectorisation = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await vectoriserService({ intention: suggestion.intention, data: suggestion.data });
      toast.success('✅ Service vectorisé !');
    } catch {
      toast.error('Erreur vectorisation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout padding>
      <View style={{ padding: 16, maxWidth: 896, marginHorizontal: 'auto' }}>
        <Title order={2} mb="md">Finalisez votre service</Title>
        <Stepper active={activeStep} onStepClick={setActiveStep} mb="xl">
          <Stepper.Step label="Génération IA" />
          <Stepper.Step label="Finalisation" />
        </Stepper>

        {loading ? (
          <Skeleton height={300} radius="md" animate />
        ) : (
          activeStep === 1 ? (
            <Stack spacing="md">
              <Text>Revoyez les suggestions générées par l’IA</Text>
              <Group spacing="md">
                <Badge color="blue">Confiance IA: {confidence ?? 0}%</Badge>
                <Badge color="green">Tokens: {tokens_consumed ?? 0}</Badge>
              </Group>
              <SimpleGrid cols={2} spacing="md" breakpoints={[{ maxWidth: 'sm', cols: 1 }]} mb="md">
                {composants.map((champ) => (
                  <View key={champ.nomChamp} style={{ padding: 8, borderWidth: 1, borderRadius: 4 }}>
                    <Text weight={500}>{champ.nomChamp}</Text>
                    <Text size="sm" mt="xs">
                      {typeof form.values[champ.nomChamp] === 'object'
                        ? form.values[champ.nomChamp]?.valeur ?? '-'
                        : form.values[champ.nomChamp] ?? '-'}
                    </Text>
                  </View>
                ))}
              </SimpleGrid>
              <Group position="right">
                <TouchableOpacity onPress={() => setActiveStep(2)}>Suivant</TouchableOpacity>
              </Group>
            </Stack>
          ) : (
            <form onSubmit={form.onSubmit(handleSaveService)}>
              <Grid gutter="md">
                {composants.map((champ) => (
                  <Grid.Col xs={12} md={6} key={champ.nomChamp}>
                    <Card shadow="xs" p="sm" radius="md">
                      <TextInput
                        label={champ.nomChamp}
                        placeholder={`Entrez ${champ.nomChamp}`}
                        {...form.getInputProps(champ.nomChamp)}
                      />
                    </Card>
                  </Grid.Col>
                ))}
              </Grid>
              <Group position="apart" mt="md">
                <TouchableOpacity variant="outline" onPress={() => setActiveStep(1)}>Précédent</TouchableOpacity>
                <Group>
                  <TouchableOpacity type="submit" loading={loading}>Enregistrer</TouchableOpacity>
                  <TouchableOpacity variant="outline" onPress={handleVectorisation} loading={loading}>Vectoriser</TouchableOpacity>
                </Group>
              </Group>
            </form>
          )
        )}
      </View>
    </AppLayout>
  );
};

export default FormulaireServiceModerne;





