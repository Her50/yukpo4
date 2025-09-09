// FormulaireServiceModerne.tsx - Page moderne pour créer des services
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { dispatchChampsFormulaireIA, ComposantFrontend } from '@/utils/form_constraint_dispatcher';
import DynamicField from '@/components/intelligence/DynamicFields';
import { creerService, vectoriserService } from '@/lib/yukpoaclient';
import { useUser } from '@/hooks/useUser';
import { ROUTES } from '@/routes/AppRoutesRegistry';

// Mantine imports
import { useForm } from '@mantine/form';
import { Paper, Title, Stepper, Grid, Card, TextInput, Group, Button, Skeleton, Badge, Text, Stack, SimpleGrid } from '@mantine/core';
import { toast } from 'react-hot-toast';
import { showSimpleServiceCreationToast, showServiceCreationErrorToast } from '@/utils/toastUtils';

const FormulaireServiceModerne: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
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
      
      // Déclencher l'événement service_created pour notifier MesServices
      window.dispatchEvent(new CustomEvent('service_created'));
      
      showSimpleServiceCreationToast();
      navigate(ROUTES.MES_SERVICES);
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
      <Paper p="lg" shadow="sm" radius="md" className="max-w-4xl mx-auto">
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
                  <Paper key={champ.nomChamp} p="sm" withBorder radius="md">
                    <Text weight={500}>{champ.nomChamp}</Text>
                    <Text size="sm" mt="xs">
                      {typeof form.values[champ.nomChamp] === 'object' 
                        ? form.values[champ.nomChamp]?.valeur ?? '-' 
                        : form.values[champ.nomChamp] ?? '-'}
                    </Text>
                  </Paper>
                ))}
              </SimpleGrid>
              <Group position="right">
                <Button onClick={() => setActiveStep(2)}>Suivant</Button>
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
                <Button variant="outline" onClick={() => setActiveStep(1)}>Précédent</Button>
                <Group>
                  <Button type="submit" loading={loading}>Enregistrer</Button>
                  <Button variant="outline" onClick={handleVectorisation} loading={loading}>Vectoriser</Button>
                </Group>
              </Group>
            </form>
          )
        )}
      </Paper>
    </AppLayout>
  );
};

export default FormulaireServiceModerne;
