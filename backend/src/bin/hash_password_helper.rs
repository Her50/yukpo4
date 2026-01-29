// Utilitaire pour hasher un mot de passe avec bcrypt
// Usage: cargo run --bin hash_password_helper <password>
use bcrypt::hash;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: cargo run --bin hash_password_helper <password>");
        eprintln!("Example: cargo run --bin hash_password_helper Hernandez87");
        std::process::exit(1);
    }

    let password = &args[1];
    let cost = 12u32; // Utiliser cost 12 pour plus de sécurité

    match hash(password, cost) {
        Ok(hash) => println!("{}", hash),
        Err(e) => {
            eprintln!("Erreur lors du hachage: {}", e);
            std::process::exit(1);
        }
    }
}
