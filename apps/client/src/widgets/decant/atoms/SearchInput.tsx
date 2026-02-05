import "./SearchInput.css";

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function SearchInput({
    value,
    onChange,
    placeholder = "Search your tree...",
    className = "",
}: SearchInputProps) {
    return (
        <div className={`decant-search-input ${className}`}>
            <i className="bx bx-search decant-search-input__icon" />
            <input
                type="text"
                className="decant-search-input__field"
                value={value}
                onChange={(e) => onChange((e.target as HTMLInputElement).value)}
                placeholder={placeholder}
                aria-label={placeholder}
            />
            {value && (
                <button
                    type="button"
                    className="decant-search-input__clear"
                    onClick={() => onChange("")}
                    aria-label="Clear search"
                >
                    <i className="bx bx-x" />
                </button>
            )}
        </div>
    );
}
