#!/usr/bin/env node

const { Pool } = require('pg');

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://yukpo_user:password@34.79.199.41:5432/yukpo_db',
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkAndRemoveSpeedBumps() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Vérification des alertes speed_bump dans la base de données...');
    
    // Compter les speed_bump existants
    const countResult = await client.query(
      "SELECT COUNT(*) as count FROM navigation_checkpoints WHERE checkpoint_type = 'speed_bump'"
    );
    const count = parseInt(countResult.rows[0].count);
    
    console.log(`📊 Nombre d'alertes speed_bump trouvées: ${count}`);
    
    if (count > 0) {
      // Afficher les détails
      const detailsResult = await client.query(
        `SELECT id, checkpoint_type, latitude, longitude, description, created_at, expires_at 
         FROM navigation_checkpoints 
         WHERE checkpoint_type = 'speed_bump' 
         ORDER BY created_at DESC 
         LIMIT 10`
      );
      
      console.log('\n📋 Détail des alertes speed_bump:');
      detailsResult.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Position: (${row.latitude}, ${row.longitude}), Créée: ${row.created_at}`);
        if (row.description) console.log(`    Description: ${row.description}`);
      });
      
      // Demander confirmation pour supprimer
      console.log('\n⚠️  Les speed_bump sont des alertes fixes permanentes (dos d\'âne).');
      console.log('📝 Selon la nouvelle logique, elles ne doivent pas apparaître dans la liste des alertes communautaires.');
      console.log('🔊 Mais l\'alerte sonore doit être conservée lors du passage à proximité.');
      console.log('\n❌ Voulez-vous supprimer ces alertes speed_bump de la base de données ? (y/N)');
      
      // Pour l'instant, on ne supprime pas automatiquement
      console.log('🔄 Aucune suppression automatique - les speed_bump seront filtrées dans l\'interface mobile');
      
      // Si vous voulez quand même supprimer, décommentez le code ci-dessous:
      /*
      const deleteResult = await client.query(
        "DELETE FROM navigation_checkpoints WHERE checkpoint_type = 'speed_bump'"
      );
      console.log(`✅ ${deleteResult.rowCount} alertes speed_bump supprimées de la base de données.`);
      */
    } else {
      console.log('✅ Aucune alerte speed_bump trouvée dans la base de données.');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAndRemoveSpeedBumps();
